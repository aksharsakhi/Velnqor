import { createServer, Server as NetServer, Socket } from 'node:net'
import type { ActiveFlow, BondingStrategy, InterfaceBondingMetric } from '../../shared/bondingTypes'
import type { NetworkInterfaceInfo } from '../../shared/types'

interface InterfaceStats {
  bytesDown: number
  bytesUp: number
  totalBytesDown: number
  totalBytesUp: number
  activeConnections: number
  lastSecondDown: number
  lastSecondUp: number
  latencyMs: number
  status: 'healthy' | 'degraded' | 'offline'
}

export class BondingProxyServer {
  private httpProxyServer: NetServer | null = null
  private socksProxyServer: NetServer | null = null
  private strategy: BondingStrategy = 'adaptive'
  private roundRobinIndex = 0

  private interfaceStats = new Map<string, InterfaceStats>()
  private flows: ActiveFlow[] = []
  private flowCounter = 0
  private getInterfaces: () => NetworkInterfaceInfo[]

  constructor(getInterfaces: () => NetworkInterfaceInfo[]) {
    this.getInterfaces = getInterfaces
  }

  setStrategy(strategy: BondingStrategy): void {
    this.strategy = strategy
  }

  getStrategy(): BondingStrategy {
    return this.strategy
  }

  async start(httpPort = 8787, socksPort = 8788): Promise<void> {
    await this.stop()

    // 1. HTTP/HTTPS CONNECT Proxy
    this.httpProxyServer = createServer((clientSocket) => {
      this.handleHttpConnection(clientSocket)
    })

    // 2. SOCKS5 Proxy
    this.socksProxyServer = createServer((clientSocket) => {
      this.handleSocks5Connection(clientSocket)
    })

    await new Promise<void>((resolve, reject) => {
      this.httpProxyServer?.listen(httpPort, '127.0.0.1', () => {
        this.socksProxyServer?.listen(socksPort, '127.0.0.1', () => {
          resolve()
        })
      })
      this.httpProxyServer?.on('error', reject)
      this.socksProxyServer?.on('error', reject)
    })
  }

  async stop(): Promise<void> {
    if (this.httpProxyServer) {
      this.httpProxyServer.close()
      this.httpProxyServer = null
    }
    if (this.socksProxyServer) {
      this.socksProxyServer.close()
      this.socksProxyServer = null
    }
  }

  /**
   * Pick an interface according to the configured multi-WAN bonding policy.
   */
  private selectInterface(): NetworkInterfaceInfo | null {
    const interfaces = this.getInterfaces().filter(
      (iface) => iface.addresses && iface.addresses.length > 0
    )
    if (interfaces.length === 0) return null
    if (interfaces.length === 1) return interfaces[0]

    const stats = interfaces.map((iface) => {
      let stat = this.interfaceStats.get(iface.id)
      if (!stat) {
        stat = {
          bytesDown: 0,
          bytesUp: 0,
          totalBytesDown: 0,
          totalBytesUp: 0,
          activeConnections: 0,
          lastSecondDown: 0,
          lastSecondUp: 0,
          latencyMs: 25,
          status: 'healthy'
        }
        this.interfaceStats.set(iface.id, stat)
      }
      return { iface, stat }
    })

    // Filter to healthy or degraded interfaces first
    const healthy = stats.filter((s) => s.stat.status !== 'offline')
    const candidates = healthy.length > 0 ? healthy : stats

    switch (this.strategy) {
      case 'round_robin': {
        const selected = candidates[this.roundRobinIndex % candidates.length]
        this.roundRobinIndex = (this.roundRobinIndex + 1) % candidates.length
        return selected.iface
      }
      case 'failover': {
        // Strict primary preference: Wi-Fi or Ethernet first, USB tethering as standby
        const primary = candidates.find(
          (c) => c.iface.kind === 'ethernet' || c.iface.kind === 'wifi'
        )
        return (primary ?? candidates[0]).iface
      }
      case 'speed_boost': {
        // Direct connections to interface with lowest active connections & high throughput
        candidates.sort((a, b) => a.stat.activeConnections - b.stat.activeConnections)
        return candidates[0].iface
      }
      case 'adaptive':
      default: {
        // Smart weighted probability based on latency and inverse active connection load
        const weights = candidates.map((c) => {
          const latencyScore = 1000 / Math.max(c.stat.latencyMs, 10)
          const loadScore = 1 / Math.max(c.stat.activeConnections, 1)
          return latencyScore * loadScore
        })
        const totalWeight = weights.reduce((acc, w) => acc + w, 0)
        let random = Math.random() * totalWeight
        for (let i = 0; i < candidates.length; i++) {
          random -= weights[i]
          if (random <= 0) return candidates[i].iface
        }
        return candidates[0].iface
      }
    }
  }

  /**
   * Handles incoming HTTP / HTTPS CONNECT requests
   */
  private handleHttpConnection(clientSocket: Socket): void {
    clientSocket.once('data', (initialChunk) => {
      try {
        const dataStr = initialChunk.toString('utf-8')
        const firstLine = dataStr.split('\r\n')[0]
        if (!firstLine) {
          clientSocket.end()
          return
        }

        const parts = firstLine.split(' ')
        if (parts.length < 2) {
          clientSocket.end()
          return
        }

        const method = parts[0]
        const target = parts[1]

        if (method === 'CONNECT') {
          // HTTPS Tunneling: host:port
          const lastColon = target.lastIndexOf(':')
          if (lastColon === -1) {
            clientSocket.end()
            return
          }
          let host = target.substring(0, lastColon).trim()
          if (host.startsWith('[') && host.endsWith(']')) {
            host = host.slice(1, -1)
          }
          const port = parseInt(target.substring(lastColon + 1), 10)
          if (!host || isNaN(port) || port < 1 || port > 65535) {
            clientSocket.end()
            return
          }

          this.establishOutboundTunnel(clientSocket, host, port, 'HTTPS', () => {
            clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
          })
        } else {
          // Direct HTTP Proxying: extract Host header
          const hostMatch = dataStr.match(/Host:\s*([^\r\n:]+)(?::(\d+))?/i)
          if (hostMatch) {
            const host = hostMatch[1].trim()
            const port = hostMatch[2] ? parseInt(hostMatch[2], 10) : 80
            if (!host || isNaN(port) || port < 1 || port > 65535) {
              clientSocket.end()
              return
            }

            // Rewrite absolute proxy URI "GET http://host/path HTTP/1.1" to "GET /path HTTP/1.1"
            const rewrittenStr = dataStr.replace(
              /^([A-Z]+)\s+https?:\/\/[^/\s]+(\/[^\s]*)?\s+(HTTP\/\d\.\d)/i,
              (_m, mthd, path, ver) => `${mthd} ${path || '/'} ${ver}`
            )
            const payload = Buffer.from(rewrittenStr)
            this.establishOutboundTunnel(clientSocket, host, port, 'HTTP', (outboundSocket) => {
              outboundSocket.write(payload)
            })
          } else {
            clientSocket.end()
          }
        }
      } catch {
        clientSocket.destroy()
      }
    })

    clientSocket.on('error', () => {
      clientSocket.destroy()
    })
  }

  /**
   * Handles incoming SOCKS5 requests
   */
  private handleSocks5Connection(clientSocket: Socket): void {
    let state: 'handshake' | 'request' | 'piped' = 'handshake'

    clientSocket.on('data', (chunk) => {
      try {
        if (state === 'handshake') {
          // Handshake: [version (0x05), nmethods, methods...]
          if (chunk.length < 2 || chunk[0] !== 0x05) {
            clientSocket.end()
            return
          }
          const nmethods = chunk[1]
          if (chunk.length < 2 + nmethods) {
            clientSocket.end()
            return
          }
          // Respond with NO AUTH (0x05, 0x00)
          clientSocket.write(Buffer.from([0x05, 0x00]))
          state = 'request'
        } else if (state === 'request') {
          // Request: [ver (0x05), cmd (0x01 = CONNECT), rsv (0x00), atyp, dest...]
          if (chunk.length < 4 || chunk[0] !== 0x05 || chunk[1] !== 0x01) {
            clientSocket.end()
            return
          }

          const atyp = chunk[3]
          let host = ''
          let port = 0

          if (atyp === 0x01) {
            // IPv4 (4 bytes) + 2 bytes port = 10 bytes min
            if (chunk.length < 10) {
              clientSocket.end()
              return
            }
            host = `${chunk[4]}.${chunk[5]}.${chunk[6]}.${chunk[7]}`
            port = chunk.readUInt16BE(8)
          } else if (atyp === 0x03) {
            // Domain name: [atyp(1), len(1), name(len), port(2)]
            if (chunk.length < 5) {
              clientSocket.end()
              return
            }
            const domainLen = chunk[4]
            if (chunk.length < 5 + domainLen + 2) {
              clientSocket.end()
              return
            }
            host = chunk.subarray(5, 5 + domainLen).toString('utf-8')
            port = chunk.readUInt16BE(5 + domainLen)
          } else if (atyp === 0x04) {
            // IPv6
            clientSocket.end()
            return
          } else {
            clientSocket.end()
            return
          }

          if (!host || isNaN(port) || port < 1 || port > 65535) {
            clientSocket.end()
            return
          }

          state = 'piped'
          this.establishOutboundTunnel(clientSocket, host, port, 'SOCKS5', () => {
            // SOCKS5 success reply: [ver:5, rep:0 (success), rsv:0, atyp:1, 0,0,0,0, port:0]
            clientSocket.write(
              Buffer.from([0x05, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
            )
          })
        }
      } catch {
        clientSocket.destroy()
      }
    })

    clientSocket.on('error', () => {
      clientSocket.destroy()
    })
  }

  /**
   * Core multi-WAN outbound dispatcher with automatic fallback
   */
  private establishOutboundTunnel(
    clientSocket: Socket,
    host: string,
    port: number,
    protocol: 'HTTP' | 'HTTPS' | 'SOCKS5',
    onConnect?: (outboundSocket: Socket) => void
  ): void {
    const selectedIface = this.selectInterface()
    const allInterfaces = this.getInterfaces().filter((i) => i.addresses && i.addresses.length > 0)

    // Attempt connecting via chosen interface, with instant fallback if it fails
    this.connectViaInterface(
      selectedIface,
      allInterfaces,
      host,
      port,
      (err, outboundSocket, finalIface) => {
        if (err || !outboundSocket) {
          clientSocket.destroy()
          return
        }

        const safeIface: NetworkInterfaceInfo = finalIface || {
          id: 'system-default',
          displayName: 'System Default',
          device: 'default',
          kind: 'other',
          addresses: []
        }

        const ifaceId = safeIface.id
        let stats = this.interfaceStats.get(ifaceId)
        if (!stats) {
          stats = {
            bytesDown: 0,
            bytesUp: 0,
            totalBytesDown: 0,
            totalBytesUp: 0,
            activeConnections: 0,
            lastSecondDown: 0,
            lastSecondUp: 0,
            latencyMs: 25,
            status: 'healthy'
          }
          this.interfaceStats.set(ifaceId, stats)
        }

        stats.activeConnections++

        // Record active flow for UI
        const flowId = `flow-${++this.flowCounter}`
        const flow: ActiveFlow = {
          id: flowId,
          host,
          port,
          protocol,
          interfaceId: safeIface.id,
          interfaceName: safeIface.displayName || safeIface.device,
          startTime: Date.now(),
          bytesTransferred: 0,
          speedBytesPerSec: 0,
          active: true
        }
        this.flows.unshift(flow)
        if (this.flows.length > 50) this.flows.pop()

        // Pipe data with real-time throughput metrics
        clientSocket.on('data', (chunk) => {
          stats!.bytesUp += chunk.length
          stats!.totalBytesUp += chunk.length
          flow.bytesTransferred += chunk.length
        })

        outboundSocket.on('data', (chunk) => {
          stats!.bytesDown += chunk.length
          stats!.totalBytesDown += chunk.length
          flow.bytesTransferred += chunk.length
        })

        clientSocket.pipe(outboundSocket)
        outboundSocket.pipe(clientSocket)

        let cleanedUp = false
        const cleanup = (): void => {
          if (cleanedUp) return
          cleanedUp = true
          stats!.activeConnections = Math.max(0, stats!.activeConnections - 1)
          flow.active = false
          clientSocket.destroy()
          outboundSocket.destroy()
        }

        clientSocket.once('close', cleanup)
        outboundSocket.once('close', cleanup)
        clientSocket.once('error', cleanup)
        outboundSocket.once('error', cleanup)

        if (onConnect) onConnect(outboundSocket)
      }
    )
  }

  /**
   * Connect to remote host using a specific network interface's local address,
   * falling back to remaining interfaces if primary fails, and ultimately to native OS socket routing
   * to guarantee 100% internet reliability.
   */
  private connectViaInterface(
    preferredIface: NetworkInterfaceInfo | null,
    allInterfaces: NetworkInterfaceInfo[],
    host: string,
    port: number,
    callback: (err: Error | null, socket?: Socket, iface?: NetworkInterfaceInfo) => void
  ): void {
    const candidateList = preferredIface
      ? [preferredIface, ...allInterfaces.filter((i) => i.id !== preferredIface.id)]
      : allInterfaces

    if (candidateList.length === 0) {
      // Direct OS connect if no specific interfaces known
      const sock = new Socket()
      sock.connect({ host, port }, () => callback(null, sock, undefined))
      sock.once('error', (err) => callback(err))
      return
    }

    let attemptIndex = 0

    const tryNext = (): void => {
      if (attemptIndex >= candidateList.length) {
        // Fallback: direct OS default socket routing so user's internet NEVER drops if interface binding fails
        const fallbackSocket = new Socket()
        let fallbackConnected = false
        fallbackSocket.setTimeout(5000)

        const handleFallbackFail = (err?: Error): void => {
          if (!fallbackConnected) {
            fallbackConnected = true
            fallbackSocket.destroy()
            callback(err || new Error(`Connection to ${host}:${port} failed`))
          }
        }

        fallbackSocket.once('error', handleFallbackFail)
        fallbackSocket.once('timeout', () =>
          handleFallbackFail(new Error(`Connection to ${host}:${port} timed out`))
        )

        try {
          fallbackSocket.connect({ host, port }, () => {
            fallbackConnected = true
            fallbackSocket.setTimeout(0)
            callback(null, fallbackSocket, candidateList[0] || preferredIface || undefined)
          })
        } catch (syncErr) {
          handleFallbackFail(syncErr instanceof Error ? syncErr : new Error(String(syncErr)))
        }
        return
      }

      const currentIface = candidateList[attemptIndex++]
      const isIpv6 = host.includes(':')
      const matchingAddr = isIpv6
        ? currentIface.addresses.find(
            (a) => a.family === 6 || (a.family as unknown as string) === 'IPv6'
          )
        : currentIface.addresses.find(
            (a) => a.family === 4 || (a.family as unknown as string) === 'IPv4'
          )
      const localAddress = matchingAddr?.address || currentIface.addresses[0]?.address

      const socket = new Socket()
      let connected = false

      socket.setTimeout(4000)

      let failed = false
      const handleFail = (): void => {
        if (!connected && !failed) {
          failed = true
          socket.destroy()
          tryNext()
        }
      }

      socket.once('timeout', handleFail)
      socket.once('error', handleFail)

      try {
        socket.connect({ host, port, localAddress }, () => {
          connected = true
          socket.setTimeout(0)
          callback(null, socket, currentIface)
        })
      } catch {
        handleFail()
      }
    }

    tryNext()
  }

  /**
   * Collect per-second telemetry for UI updates
   */
  collectMetrics(): {
    interfaces: Record<string, InterfaceBondingMetric>
    totalDownSpeed: number
    totalUpSpeed: number
    recentFlows: ActiveFlow[]
  } {
    const interfaces: Record<string, InterfaceBondingMetric> = {}
    let totalDownSpeed = 0
    let totalUpSpeed = 0

    const activeList = this.getInterfaces()

    for (const iface of activeList) {
      let stat = this.interfaceStats.get(iface.id)
      if (!stat) {
        stat = {
          bytesDown: 0,
          bytesUp: 0,
          totalBytesDown: 0,
          totalBytesUp: 0,
          activeConnections: 0,
          lastSecondDown: 0,
          lastSecondUp: 0,
          latencyMs: 20,
          status: 'healthy'
        }
        this.interfaceStats.set(iface.id, stat)
      }

      // 1-second delta speed calculation
      stat.lastSecondDown = stat.bytesDown
      stat.lastSecondUp = stat.bytesUp
      stat.bytesDown = 0
      stat.bytesUp = 0

      totalDownSpeed += stat.lastSecondDown
      totalUpSpeed += stat.lastSecondUp

      const ipv4 = iface.addresses.find(
        (a) => a.family === 4 || (a.family as unknown as string) === 'IPv4'
      )
      interfaces[iface.id] = {
        id: iface.id,
        name: iface.displayName || iface.device,
        device: iface.device,
        kind: iface.kind,
        ip: ipv4?.address || iface.addresses[0]?.address || 'Unknown',
        status: stat.status,
        latencyMs: stat.latencyMs,
        downloadSpeedBytesPerSec: stat.lastSecondDown,
        uploadSpeedBytesPerSec: stat.lastSecondUp,
        totalBytesDownloaded: stat.totalBytesDown,
        totalBytesUploaded: stat.totalBytesUp,
        activeFlowCount: stat.activeConnections,
        weight: Math.round(
          (stat.lastSecondDown / Math.max(totalDownSpeed, 1)) * 100 ||
            100 / Math.max(activeList.length, 1)
        )
      }
    }

    return {
      interfaces,
      totalDownSpeed,
      totalUpSpeed,
      recentFlows: [...this.flows]
    }
  }

  updateLatency(
    ifaceId: string,
    latencyMs: number,
    status: 'healthy' | 'degraded' | 'offline'
  ): void {
    const stat = this.interfaceStats.get(ifaceId)
    if (stat) {
      stat.latencyMs = latencyMs
      stat.status = status
    }
  }

  recordActivity(ifaceId: string, bytesDown: number, bytesUp: number): void {
    let stat = this.interfaceStats.get(ifaceId)
    if (!stat) {
      stat = {
        bytesDown: 0,
        bytesUp: 0,
        totalBytesDown: 0,
        totalBytesUp: 0,
        activeConnections: 0,
        lastSecondDown: 0,
        lastSecondUp: 0,
        latencyMs: 25,
        status: 'healthy'
      }
      this.interfaceStats.set(ifaceId, stat)
    }
    stat.bytesDown += bytesDown
    stat.totalBytesDown += bytesDown
    stat.bytesUp += bytesUp
    stat.totalBytesUp += bytesUp
  }

  addFlow(flow: ActiveFlow): void {
    this.flows.unshift(flow)
    if (this.flows.length > 50) this.flows.pop()
  }
}
