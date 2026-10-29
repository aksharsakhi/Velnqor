import { execFile, execFileSync } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/** Strict validation for network service names to prevent command injection and malformed arguments */
function isValidServiceName(service: string): boolean {
  return (
    typeof service === 'string' &&
    service.length > 0 &&
    service.length <= 128 &&
    /^[a-zA-Z0-9_\- .()]+$/.test(service) &&
    !service.includes('\0')
  )
}

function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535
}

export class SystemProxyManager {
  private activeServices: string[] = []
  private isConfigured = false

  /**
   * Retrieves active macOS network services that can accept proxy settings (async).
   */
  async getMacNetworkServices(): Promise<string[]> {
    if (process.platform !== 'darwin') return []
    try {
      const { stdout } = await execFileAsync('networksetup', ['-listallnetworkservices'])
      const lines = stdout
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.includes('*') && !l.includes('An asterisk') && isValidServiceName(l))
      return lines
    } catch {
      return ['Wi-Fi', 'iPhone USB', 'Ethernet']
    }
  }

  /**
   * Retrieves active macOS network services synchronously for critical teardown routines.
   */
  getMacNetworkServicesSync(): string[] {
    if (process.platform !== 'darwin') return []
    try {
      const stdout = execFileSync('networksetup', ['-listallnetworkservices'], {
        encoding: 'utf-8',
        timeout: 2000
      })
      const lines = stdout
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.includes('*') && !l.includes('An asterisk') && isValidServiceName(l))
      return lines
    } catch {
      return ['Wi-Fi', 'iPhone USB', 'Ethernet']
    }
  }

  /**
   * Enables system-wide proxy routing through Velnqor's local bonding proxy.
   */
  async enable(httpPort = 8787, socksPort = 8788): Promise<boolean> {
    if (!isValidPort(httpPort) || !isValidPort(socksPort)) {
      console.error('[Velnqor] Invalid proxy port specified:', { httpPort, socksPort })
      return false
    }

    if (process.platform === 'darwin') {
      try {
        const services = await this.getMacNetworkServices()
        this.activeServices = services

        for (const service of services) {
          if (!isValidServiceName(service)) continue

          // Set Web Proxy (HTTP) safely without shell expansion
          await execFileAsync('networksetup', [
            '-setwebproxy',
            service,
            '127.0.0.1',
            String(httpPort)
          ]).catch(() => {})
          await execFileAsync('networksetup', ['-setwebproxystate', service, 'on']).catch(() => {})

          // Set Secure Web Proxy (HTTPS)
          await execFileAsync('networksetup', [
            '-setsecurewebproxy',
            service,
            '127.0.0.1',
            String(httpPort)
          ]).catch(() => {})
          await execFileAsync('networksetup', ['-setsecurewebproxystate', service, 'on']).catch(
            () => {}
          )

          // Set SOCKS Firewall Proxy
          await execFileAsync('networksetup', [
            '-setsocksfirewallproxy',
            service,
            '127.0.0.1',
            String(socksPort)
          ]).catch(() => {})
          await execFileAsync('networksetup', ['-setsocksfirewallproxystate', service, 'on']).catch(
            () => {}
          )

          // Set proxy bypass domains so localhost, captive portals, and local devices bypass proxy
          await execFileAsync('networksetup', [
            '-setproxybypassdomains',
            service,
            '127.0.0.1',
            'localhost',
            '*.local',
            '169.254/16',
            '*.apple.com',
            'captive.apple.com'
          ]).catch(() => {})
        }

        this.isConfigured = true
        return true
      } catch (err) {
        console.error('[Velnqor] Failed to configure macOS system proxy:', err)
        return false
      }
    } else if (process.platform === 'win32') {
      try {
        await execFileAsync('reg.exe', [
          'add',
          'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings',
          '/v',
          'ProxyEnable',
          '/t',
          'REG_DWORD',
          '/d',
          '1',
          '/f'
        ])
        await execFileAsync('reg.exe', [
          'add',
          'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings',
          '/v',
          'ProxyServer',
          '/t',
          'REG_SZ',
          '/d',
          `http=127.0.0.1:${httpPort};https=127.0.0.1:${httpPort};socks=127.0.0.1:${socksPort}`,
          '/f'
        ])
        this.isConfigured = true
        return true
      } catch (err) {
        console.error('[Velnqor] Failed to configure Windows system proxy:', err)
        return false
      }
    }

    return false
  }

  /**
   * Disables system proxy routing and restores direct OS routing across all network interfaces.
   */
  async disable(): Promise<boolean> {
    if (process.platform === 'darwin') {
      try {
        const discovered = await this.getMacNetworkServices()
        const services = Array.from(
          new Set([...this.activeServices, ...discovered, 'Wi-Fi', 'iPhone USB', 'Ethernet'])
        )

        for (const service of services) {
          if (!isValidServiceName(service)) continue
          await execFileAsync('networksetup', ['-setwebproxystate', service, 'off']).catch(() => {})
          await execFileAsync('networksetup', ['-setsecurewebproxystate', service, 'off']).catch(
            () => {}
          )
          await execFileAsync('networksetup', [
            '-setsocksfirewallproxystate',
            service,
            'off'
          ]).catch(() => {})
        }

        this.isConfigured = false
        return true
      } catch (err) {
        console.error('[Velnqor] Failed to disable macOS system proxy:', err)
        return false
      }
    } else if (process.platform === 'win32') {
      try {
        await execFileAsync('reg.exe', [
          'add',
          'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings',
          '/v',
          'ProxyEnable',
          '/t',
          'REG_DWORD',
          '/d',
          '0',
          '/f'
        ])
        this.isConfigured = false
        return true
      } catch (err) {
        console.error('[Velnqor] Failed to disable Windows system proxy:', err)
        return false
      }
    }

    this.isConfigured = false
    return false
  }

  /**
   * Synchronously disables system proxy routing across all network interfaces.
   * Invoked during process termination, SIGINT/SIGTERM, or crash handling to guarantee
   * that macOS internet settings are immediately returned to pristine direct state.
   */
  disableSync(): void {
    if (process.platform === 'darwin') {
      try {
        const discovered = this.getMacNetworkServicesSync()
        const services = Array.from(
          new Set([...this.activeServices, ...discovered, 'Wi-Fi', 'iPhone USB', 'Ethernet'])
        )

        for (const service of services) {
          if (!isValidServiceName(service)) continue
          try {
            execFileSync('networksetup', ['-setwebproxystate', service, 'off'], { timeout: 1500 })
          } catch {
            // Best effort per-service reset
          }
          try {
            execFileSync('networksetup', ['-setsecurewebproxystate', service, 'off'], {
              timeout: 1500
            })
          } catch {
            // Best effort per-service reset
          }
          try {
            execFileSync('networksetup', ['-setsocksfirewallproxystate', service, 'off'], {
              timeout: 1500
            })
          } catch {
            // Best effort per-service reset
          }
        }
      } catch {
        // Best-effort synchronous cleanup
      }
    } else if (process.platform === 'win32') {
      try {
        execFileSync(
          'reg.exe',
          [
            'add',
            'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings',
            '/v',
            'ProxyEnable',
            '/t',
            'REG_DWORD',
            '/d',
            '0',
            '/f'
          ],
          { timeout: 1500 }
        )
      } catch {
        // Best effort Windows registry reset
      }
    }

    this.isConfigured = false
  }

  /**
   * Scans all network services on startup to detect and clean up any orphaned proxy configuration
   * left behind by abnormal termination (e.g. force quit, system restart, power loss).
   */
  async sanitizeStartupProxies(httpPort = 8787, socksPort = 8788): Promise<void> {
    if (process.platform === 'darwin') {
      try {
        const services = await this.getMacNetworkServices()
        const serviceSet = Array.from(new Set([...services, 'Wi-Fi', 'iPhone USB', 'Ethernet']))

        for (const service of serviceSet) {
          if (!isValidServiceName(service)) continue

          try {
            const [webOut, secOut, socksOut] = await Promise.all([
              execFileAsync('networksetup', ['-getwebproxy', service]).catch(() => ({
                stdout: ''
              })),
              execFileAsync('networksetup', ['-getsecurewebproxy', service]).catch(() => ({
                stdout: ''
              })),
              execFileAsync('networksetup', ['-getsocksfirewallproxy', service]).catch(() => ({
                stdout: ''
              }))
            ])

            const isStaleLocalProxy = (out: string): boolean => {
              const lower = out.toLowerCase()
              const isEnabled = lower.includes('enabled: yes')
              const isLocal = lower.includes('127.0.0.1') || lower.includes('localhost')
              const matchesPort =
                lower.includes(String(httpPort)) || lower.includes(String(socksPort))
              return isEnabled && (isLocal || matchesPort)
            }

            if (isStaleLocalProxy(webOut.stdout)) {
              console.warn(`[Velnqor] Sanitizing stale web proxy on ${service}`)
              await execFileAsync('networksetup', ['-setwebproxystate', service, 'off']).catch(
                () => {}
              )
            }
            if (isStaleLocalProxy(secOut.stdout)) {
              console.warn(`[Velnqor] Sanitizing stale secure web proxy on ${service}`)
              await execFileAsync('networksetup', [
                '-setsecurewebproxystate',
                service,
                'off'
              ]).catch(() => {})
            }
            if (isStaleLocalProxy(socksOut.stdout)) {
              console.warn(`[Velnqor] Sanitizing stale SOCKS proxy on ${service}`)
              await execFileAsync('networksetup', [
                '-setsocksfirewallproxystate',
                service,
                'off'
              ]).catch(() => {})
            }
          } catch {
            // Best effort per service check
          }
        }
      } catch (err) {
        console.error('[Velnqor] Failed to sanitize startup proxies:', err)
      }
    }
  }

  /**
   * Checks whether system proxy is currently enabled.
   */
  async isEnabled(): Promise<boolean> {
    if (process.platform === 'darwin') {
      try {
        const services = await this.getMacNetworkServices()
        const primary = services[0] || 'Wi-Fi'
        if (!isValidServiceName(primary)) return this.isConfigured

        const { stdout } = await execFileAsync('networksetup', ['-getwebproxy', primary])
        return stdout.toLowerCase().includes('enabled: yes')
      } catch {
        return this.isConfigured
      }
    }
    return this.isConfigured
  }

  /**
   * Ensures clean teardown on application shutdown so user settings aren't left broken.
   */
  installShutdownHooks(): void {
    const cleanup = (): void => {
      this.disableSync()
    }

    process.on('exit', cleanup)
    process.on('SIGINT', () => {
      cleanup()
      process.exit(0)
    })
    process.on('SIGTERM', () => {
      cleanup()
      process.exit(0)
    })
    process.on('uncaughtException', (err) => {
      console.error('[Velnqor] Uncaught exception, cleaning up proxy:', err)
      cleanup()
      process.exit(1)
    })
  }
}
