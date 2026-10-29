import { Socket } from 'node:net'
import https from 'node:https'
import { execFile } from 'node:child_process'
import type { BrowserWindow } from 'electron'
import type {
  BondingState,
  BondingStrategy,
  InterfaceBondingMetric
} from '../../shared/bondingTypes'
import { IpcChannels } from '../../shared/ipc-channels'
import type { NetworkMonitor } from '../network/interfaces'
import { BondingProxyServer } from './bondingProxy'
import { SystemProxyManager } from './systemProxy'

interface HwSample {
  ibytes: number
  obytes: number
  timestamp: number
}

interface HwSpeed {
  downSpeed: number
  upSpeed: number
}

export class BondingManager {
  private proxy: BondingProxyServer
  private systemProxy: SystemProxyManager
  private networkMonitor: NetworkMonitor
  private getWindow: () => BrowserWindow | null

  private active = false
  private strategy: BondingStrategy = 'adaptive'
  private systemProxyActive = false
  private isSpeedTesting = false
  private httpPort = 8787
  private socksPort = 8788
  private error: string | null = null

  // Session cumulative totals
  private sessionTotalBytesDown = 0
  private sessionTotalBytesUp = 0

  // Hardware traffic tracking
  private prevHwSamples = new Map<string, HwSample>()
  private hwSpeeds = new Map<string, HwSpeed>()

  private telemetryTimer: NodeJS.Timeout | null = null
  private probeTimer: NodeJS.Timeout | null = null
  private hwPollTimer: NodeJS.Timeout | null = null

  constructor(networkMonitor: NetworkMonitor, getWindow: () => BrowserWindow | null) {
    this.networkMonitor = networkMonitor
    this.getWindow = getWindow
    this.proxy = new BondingProxyServer(() => this.networkMonitor.current ?? [])
    this.systemProxy = new SystemProxyManager()
    this.systemProxy.installShutdownHooks()

    this.startBackgroundLoops()
  }

  async start(): Promise<boolean> {
    try {
      this.error = null
      await this.proxy.start(this.httpPort, this.socksPort)
      this.active = true
      // Auto-enable system proxy on activation so Mac-wide traffic is accelerated
      this.systemProxyActive = true
      await this.systemProxy.enable(this.httpPort, this.socksPort)

      // Also route Electron's own webContents traffic through proxy
      const win = this.getWindow()
      if (win && !win.isDestroyed()) {
        await win.webContents.session
          .setProxy({
            proxyRules: `http=127.0.0.1:${this.httpPort};https=127.0.0.1:${this.httpPort}`
          })
          .catch(() => {})
      }

      this.broadcastState()
      return true
    } catch (err) {
      this.active = false
      this.error = err instanceof Error ? err.message : String(err)
      console.error('[Velnqor] Failed to start bonding engine:', err)
      this.broadcastState()
      return false
    }
  }

  async stop(): Promise<void> {
    try {
      await this.systemProxy.disable()
      await this.proxy.stop()
      this.active = false
      this.systemProxyActive = false
      this.error = null

      const win = this.getWindow()
      if (win && !win.isDestroyed()) {
        await win.webContents.session.setProxy({ proxyRules: '' }).catch(() => {})
      }

      this.broadcastState()
    } catch (err) {
      console.error('[Velnqor] Failed to stop bonding engine:', err)
    }
  }

  async toggleSystemProxy(enable?: boolean): Promise<boolean> {
    const target = enable ?? !this.systemProxyActive
    this.systemProxyActive = target

    if (this.active) {
      if (target) {
        await this.systemProxy.enable(this.httpPort, this.socksPort)
      } else {
        await this.systemProxy.disable()
      }
    }

    this.broadcastState()
    return this.systemProxyActive
  }

  setStrategy(strategy: BondingStrategy): void {
    this.strategy = strategy
    this.proxy.setStrategy(strategy)
    this.broadcastState()
  }

  /**
   * Runs a high-performance multi-stream speed test across both Wi-Fi and iPhone USB simultaneously.
   */
  async runSpeedTest(): Promise<void> {
    if (this.isSpeedTesting) return
    this.isSpeedTesting = true

    if (!this.active) {
      await this.start()
    }

    this.broadcastState()

    try {
      const interfaces = this.networkMonitor.current ?? []
      const activeIfaces = interfaces.filter((i) => i.addresses && i.addresses.length > 0)

      // Reliable test endpoints with CDN edge coverage
      const testUrl = 'https://speed.cloudflare.com/__down?bytes=15000000'

      const streamPromises: Promise<void>[] = []

      for (const iface of activeIfaces) {
        const ipv4 = iface.addresses.find(
          (a) => a.family === 4 || (a.family as unknown as string) === 'IPv4'
        )
        const localAddress = ipv4 ? ipv4.address : iface.addresses[0]?.address
        if (!localAddress) continue

        // Launch 2 parallel streams per physical adapter
        for (let streamIdx = 0; streamIdx < 2; streamIdx++) {
          const p = new Promise<void>((resolve) => {
            const flowId = `speedtest-${iface.device}-${streamIdx}-${Date.now()}`
            const flow = {
              id: flowId,
              host: 'speed.cloudflare.com',
              port: 443,
              protocol: 'HTTPS' as const,
              interfaceId: iface.id,
              interfaceName: iface.displayName || iface.device,
              startTime: Date.now(),
              bytesTransferred: 0,
              speedBytesPerSec: 0,
              active: true
            }
            this.proxy.addFlow(flow)

            const req = https.get(
              testUrl,
              {
                localAddress,
                timeout: 8000
              },
              (res) => {
                res.on('data', (chunk: Buffer) => {
                  this.proxy.recordActivity(iface.id, chunk.length, 0)
                  this.sessionTotalBytesDown += chunk.length
                  flow.bytesTransferred += chunk.length
                })

                res.on('end', () => {
                  flow.active = false
                  resolve()
                })

                res.on('error', () => {
                  flow.active = false
                  resolve()
                })
              }
            )

            req.on('error', () => {
              flow.active = false
              resolve()
            })

            req.on('timeout', () => {
              req.destroy()
              flow.active = false
              resolve()
            })
          })

          streamPromises.push(p)
        }
      }

      // Concurrently stream test data for up to 6 seconds
      const timeoutPromise = new Promise<void>((r) => setTimeout(r, 6500))
      await Promise.race([Promise.allSettled(streamPromises), timeoutPromise])
    } catch (err) {
      console.error('[Velnqor] Speed test error:', err)
    } finally {
      this.isSpeedTesting = false
      this.broadcastState()
    }
  }

  getState(): BondingState {
    const proxyMetrics = this.proxy.collectMetrics()
    const allInterfaces = this.networkMonitor.current ?? []

    let totalDownloadSpeed = 0
    let totalUploadSpeed = 0

    const interfaces: Record<string, InterfaceBondingMetric> = {}

    for (const iface of allInterfaces) {
      const pm = proxyMetrics.interfaces[iface.id]
      const hw = this.hwSpeeds.get(iface.device)

      // Use the higher of proxy-tracked speed and hardware-tracked speed
      const downSpeed = Math.max(pm ? pm.downloadSpeedBytesPerSec : 0, hw ? hw.downSpeed : 0)
      const upSpeed = Math.max(pm ? pm.uploadSpeedBytesPerSec : 0, hw ? hw.upSpeed : 0)

      totalDownloadSpeed += downSpeed
      totalUploadSpeed += upSpeed

      const ipv4 = iface.addresses.find(
        (a) => a.family === 4 || (a.family as unknown as string) === 'IPv4'
      )

      interfaces[iface.id] = {
        id: iface.id,
        name: iface.displayName || iface.device,
        device: iface.device,
        kind: iface.kind,
        ip: ipv4?.address || iface.addresses[0]?.address || 'No IP',
        status: pm ? pm.status : 'healthy',
        latencyMs: pm ? pm.latencyMs : 25,
        downloadSpeedBytesPerSec: downSpeed,
        uploadSpeedBytesPerSec: upSpeed,
        totalBytesDownloaded: pm ? pm.totalBytesDownloaded : 0,
        totalBytesUploaded: pm ? pm.totalBytesUploaded : 0,
        activeFlowCount: pm ? pm.activeFlowCount : 0,
        weight: 50
      }
    }

    // Compute relative traffic share percentages
    const activeIfaces = Object.values(interfaces).filter(
      (i: InterfaceBondingMetric) => i.ip !== 'No IP'
    )
    if (totalDownloadSpeed > 0) {
      for (const iface of activeIfaces) {
        iface.weight = Math.min(
          99,
          Math.max(1, Math.round((iface.downloadSpeedBytesPerSec / totalDownloadSpeed) * 100))
        )
      }
    } else if (activeIfaces.length > 0) {
      const even = Math.floor(100 / activeIfaces.length)
      for (const iface of activeIfaces) {
        iface.weight = even
      }
    }

    return {
      active: this.active,
      status: this.active ? 'active' : 'idle',
      strategy: this.strategy,
      httpPort: this.httpPort,
      socksPort: this.socksPort,
      systemProxyActive: this.systemProxyActive,
      totalDownloadSpeed,
      totalUploadSpeed,
      sessionTotalBytesDown: this.sessionTotalBytesDown,
      sessionTotalBytesUp: this.sessionTotalBytesUp,
      isSpeedTesting: this.isSpeedTesting,
      interfaces,
      recentFlows: proxyMetrics.recentFlows,
      error: this.error
    }
  }

  private broadcastState(): void {
    const window = this.getWindow()
    if (window && !window.isDestroyed()) {
      window.webContents.send(IpcChannels.bondingStateChanged, this.getState())
    }
  }

  private startBackgroundLoops(): void {
    // 1-second telemetry push to UI
    this.telemetryTimer = setInterval(() => {
      this.broadcastState()
    }, 1000)
    this.telemetryTimer.unref()

    // 1-second hardware traffic sampler (runs in 6ms on macOS)
    this.hwPollTimer = setInterval(() => {
      void this.pollHardwareStats()
    }, 1000)
    this.hwPollTimer.unref()

    // 5-second health & latency probes per interface
    this.probeTimer = setInterval(() => {
      void this.probeInterfaces()
    }, 5000)
    this.probeTimer.unref()

    void this.pollHardwareStats()
    void this.probeInterfaces()
  }

  /**
   * Reads exact hardware bytes across all physical interfaces using macOS netstat.
   */
  private async pollHardwareStats(): Promise<void> {
    if (process.platform !== 'darwin') return

    execFile('netstat', ['-b', '-n', '-i'], (err, stdout) => {
      if (err || !stdout) return

      const now = Date.now()
      const lines = stdout.split('\n')

      for (const line of lines) {
        const parts = line.trim().split(/\s+/)
        if (parts.length >= 10 && parts[2]?.startsWith('<Link#')) {
          const dev = parts[0]
          const ibytes = parseInt(parts[6], 10)
          const obytes = parseInt(parts[9], 10)

          if (isNaN(ibytes) || isNaN(obytes)) continue

          const prev = this.prevHwSamples.get(dev)
          if (prev) {
            const dt = (now - prev.timestamp) / 1000
            if (dt > 0.4) {
              const deltaDown = Math.max(0, ibytes - prev.ibytes)
              const deltaUp = Math.max(0, obytes - prev.obytes)

              const downSpeed = Math.round(deltaDown / dt)
              const upSpeed = Math.round(deltaUp / dt)

              this.hwSpeeds.set(dev, { downSpeed, upSpeed })

              if (this.active) {
                this.sessionTotalBytesDown += deltaDown
                this.sessionTotalBytesUp += deltaUp
              }
            }
          }

          this.prevHwSamples.set(dev, { ibytes, obytes, timestamp: now })
        }
      }
    })
  }

  private async probeInterfaces(): Promise<void> {
    const interfaces = this.networkMonitor.current ?? []
    for (const iface of interfaces) {
      const ipv4 = iface.addresses.find(
        (a) => a.family === 4 || (a.family as unknown as string) === 'IPv4'
      )
      const localAddress = ipv4 ? ipv4.address : iface.addresses[0]?.address
      if (!localAddress) continue

      const start = Date.now()
      const socket = new Socket()
      socket.setTimeout(2500)

      socket.connect({ host: '1.1.1.1', port: 80, localAddress }, () => {
        const latency = Math.max(1, Date.now() - start)
        this.proxy.updateLatency(iface.id, latency, latency < 250 ? 'healthy' : 'degraded')
        socket.destroy()
      })

      const handleFail = (): void => {
        const fallback = new Socket()
        fallback.setTimeout(2500)
        fallback.connect({ host: '8.8.8.8', port: 80, localAddress }, () => {
          const latency = Math.max(1, Date.now() - start)
          this.proxy.updateLatency(iface.id, latency, latency < 250 ? 'healthy' : 'degraded')
          fallback.destroy()
        })
        fallback.once('error', () => {
          this.proxy.updateLatency(iface.id, 999, 'offline')
          fallback.destroy()
        })
        fallback.once('timeout', () => {
          this.proxy.updateLatency(iface.id, 999, 'offline')
          fallback.destroy()
        })
      }

      socket.once('error', handleFail)
      socket.once('timeout', handleFail)
    }
  }

  async cleanup(): Promise<void> {
    if (this.telemetryTimer) clearInterval(this.telemetryTimer)
    if (this.probeTimer) clearInterval(this.probeTimer)
    if (this.hwPollTimer) clearInterval(this.hwPollTimer)
    await this.stop()
  }
}
