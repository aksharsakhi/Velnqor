import React, { useState } from 'react'
import {
  Activity,
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ExternalLink,
  Globe,
  Layers,
  Radio,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Wifi,
  Zap,
  Play,
  Gauge,
  Download,
  Plus,
  Pause,
  FolderOpen,
  X,
  ClipboardPaste,
  FileText
} from 'lucide-react'
import type { BondingStrategy } from '@shared/bondingTypes'
import { useAppStore } from '../store/useAppStore'
import { formatBytes } from '../utils/format'

function formatSpeed(bytesPerSec: number, speedUnit: 'bytes' | 'bits'): string {
  if (speedUnit === 'bits') {
    const bitsPerSec = bytesPerSec * 8
    if (bitsPerSec >= 1_000_000_000) return `${(bitsPerSec / 1_000_000_000).toFixed(1)} Gbps`
    if (bitsPerSec >= 1_000_000) return `${(bitsPerSec / 1_000_000).toFixed(1)} Mbps`
    if (bitsPerSec >= 1_000) return `${(bitsPerSec / 1_000).toFixed(0)} Kbps`
    return `${bitsPerSec.toFixed(0)} bps`
  }

  return `${formatBytes(bytesPerSec)}/s`
}

export function BondingDashboardScreen(): React.JSX.Element {
  const {
    bondingState,
    toggleBonding,
    setBondingStrategy,
    toggleSystemProxy,
    runSpeedTest,
    interfaces,
    loadInterfaces,
    speedUnit,
    downloads,
    history,
    openNewDownload
  } = useAppStore()

  const {
    active,
    strategy,
    systemProxyActive,
    totalDownloadSpeed,
    totalUploadSpeed,
    sessionTotalBytesDown,
    sessionTotalBytesUp,
    isSpeedTesting,
    interfaces: interfaceMetrics,
    recentFlows,
    error
  } = bondingState

  const [quickUrl, setQuickUrl] = useState('')

  const activeInterfaces = interfaces.filter((i) => i.addresses && i.addresses.length > 0)

  const downloadList = Object.values(downloads).filter((d) => d.status !== 'cancelled')

  const activeDownloads = downloadList.filter(
    (d) => d.status === 'downloading' || d.status === 'queued' || d.status === 'paused'
  )

  const completedDownloads = history.slice(0, 5)

  const strategies: {
    id: BondingStrategy
    title: string
    desc: string
    icon: React.ElementType
  }[] = [
    {
      id: 'adaptive',
      title: 'Adaptive Optimization',
      desc: 'EWMA weighting: routes bulk streams to fast links and low-latency requests to responsive links.',
      icon: Zap
    },
    {
      id: 'round_robin',
      title: 'Multi-WAN Concurrency',
      desc: 'Cycles connections evenly across all available adapters for maximum parallel throughput.',
      icon: Layers
    },
    {
      id: 'speed_boost',
      title: 'Speed Multiplexer',
      desc: 'Directs new streams to the fastest active connections with lowest load.',
      icon: Activity
    },
    {
      id: 'failover',
      title: 'Resilient Failover',
      desc: 'Primary connection with zero-drop hot standby on secondary connection.',
      icon: ShieldCheck
    }
  ]

  const handleTestSpeed = async (): Promise<void> => {
    await runSpeedTest()
  }

  const handleQuickDownload = (): void => {
    if (!quickUrl.trim()) return
    openNewDownload(quickUrl.trim())
    setQuickUrl('')
  }

  const handlePasteClipboard = async (): Promise<void> => {
    try {
      const text = await (window.velnqor || window.plexo).readClipboardText()
      if (text && text.trim()) {
        setQuickUrl(text.trim())
      }
    } catch {
      // Ignore clipboard read errors if inaccessible
    }
  }

  const handlePauseResume = async (id: string, isPaused: boolean): Promise<void> => {
    const api = window.velnqor || window.plexo
    if (isPaused) {
      await api.resumeDownload(id)
    } else {
      await api.pauseDownload(id)
    }
  }

  const handleCancel = async (id: string): Promise<void> => {
    await (window.velnqor || window.plexo).cancelDownload(id)
  }

  const handleReveal = async (id: string): Promise<void> => {
    await (window.velnqor || window.plexo).revealDownload(id)
  }

  return (
    <div className="flex h-full flex-col text-foreground select-none overflow-hidden bg-background">
      {/* 1. FIXED TOP COMMAND BAR (Non-scrolling, Never clipped by TitleBar) */}
      <div className="shrink-0 border-b border-border/80 bg-card/90 px-6 py-3.5 backdrop-blur-md shadow-sm">
        <div className="flex flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5 min-w-0">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-inner transition-all ${
                active
                  ? 'bg-emerald-500/15 text-emerald-500 ring-2 ring-emerald-500/30'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <Zap className={`h-5 w-5 ${active ? 'animate-pulse' : ''}`} />
            </div>
            <div className="truncate">
              <div className="flex items-center space-x-2">
                <h2 className="text-[14.5px] font-bold tracking-tight text-foreground truncate">
                  System-Wide Multi-WAN Bonding
                </h2>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${
                    active
                      ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                      : 'bg-muted text-muted-foreground border border-border'
                  }`}
                >
                  <span
                    className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
                      active ? 'bg-emerald-500 animate-ping' : 'bg-muted-foreground'
                    }`}
                  />
                  {active ? 'Engine Active' : 'Standby'}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                Bonding {activeInterfaces.length} active connection
                {activeInterfaces.length === 1 ? '' : 's'} (Wi-Fi + iPhone USB) into unified
                high-speed bandwidth.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5 shrink-0">
            <button
              onClick={() => void handleTestSpeed()}
              disabled={isSpeedTesting}
              className={`flex items-center space-x-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-sm transition-all active:scale-95 ${
                isSpeedTesting
                  ? 'border-blue-500/40 bg-blue-500/10 text-blue-500'
                  : 'border-border/80 bg-card hover:bg-accent text-foreground'
              }`}
            >
              {isSpeedTesting ? (
                <Gauge className="h-3.5 w-3.5 animate-spin text-blue-500" />
              ) : (
                <Play className="h-3.5 w-3.5 text-blue-500 fill-blue-500/20" />
              )}
              <span>{isSpeedTesting ? 'Benchmarking...' : 'Benchmark Speed'}</span>
            </button>

            <button
              onClick={() => void toggleBonding()}
              className={`flex items-center justify-center rounded-xl px-4 py-1.5 text-xs font-bold shadow-md transition-all active:scale-95 ${
                active
                  ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
              }`}
            >
              {active ? 'Stop Bonding' : 'Activate Bonding'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-2.5 flex items-center space-x-2 text-xs text-rose-500 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* System Proxy Sub-strip */}
        <div className="mt-2.5 pt-2.5 border-t border-border/50 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 text-muted-foreground">
            <Globe className="h-3.5 w-3.5 text-blue-500" />
            <span>Route Entire Mac Traffic:</span>
            <span
              className={`font-semibold ${
                systemProxyActive ? 'text-emerald-500' : 'text-muted-foreground'
              }`}
            >
              {systemProxyActive ? 'Accelerating All Mac Browsers, Streams & Apps' : 'Manual Mode'}
            </span>
          </div>
          <button
            onClick={() => void toggleSystemProxy()}
            className={`text-[10.5px] px-2.5 py-1 rounded-lg border font-medium transition-colors ${
              systemProxyActive
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
                : 'border-border bg-card/80 hover:bg-accent text-foreground'
            }`}
          >
            {systemProxyActive ? '✓ Mac System Proxy On' : 'Enable Mac-Wide Proxy'}
          </button>
        </div>
      </div>

      {/* 2. SCROLLABLE DASHBOARD BODY */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-5 pb-14 space-y-6 text-foreground">
        {/* Real-Time Aggregate Speedometer Cards */}
        <div className="grid grid-cols-2 gap-4">
          {/* Download Card */}
          <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/60 p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <ArrowDown className="h-4 w-4 text-emerald-500" />
                <span>Aggregate Download</span>
              </div>
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <Activity className={`h-4 w-4 ${totalDownloadSpeed > 0 ? 'animate-pulse' : ''}`} />
              </div>
            </div>

            <div className="my-2">
              <div className="text-3xl font-black tracking-tight text-foreground font-mono">
                {formatSpeed(totalDownloadSpeed, speedUnit)}
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/30">
              <span>Aggregated across {activeInterfaces.length} active links</span>
              <span className="font-mono text-foreground font-medium">
                Session: {formatBytes(sessionTotalBytesDown)}
              </span>
            </div>
          </div>

          {/* Upload Card */}
          <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/60 p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <ArrowUp className="h-4 w-4 text-blue-500" />
                <span>Aggregate Upload</span>
              </div>
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                <Radio className={`h-4 w-4 ${totalUploadSpeed > 0 ? 'animate-pulse' : ''}`} />
              </div>
            </div>

            <div className="my-2">
              <div className="text-3xl font-black tracking-tight text-foreground font-mono">
                {formatSpeed(totalUploadSpeed, speedUnit)}
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/30">
              <span>Multi-WAN Outbound Multiplexing</span>
              <span className="font-mono text-foreground font-medium">
                Session: {formatBytes(sessionTotalBytesUp)}
              </span>
            </div>
          </div>
        </div>

        {/* Detected Hardware Network Adapters (Side-by-Side) */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center space-x-2">
              <span>Detected Network Adapters</span>
              <span className="text-[11px] text-muted-foreground font-mono">
                ({interfaces.length} available)
              </span>
            </h3>
            <button
              onClick={() => void loadInterfaces()}
              className="flex items-center space-x-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Scan Networks</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            {interfaces.map((iface) => {
              const metric = interfaceMetrics[iface.id]
              const isIphone =
                iface.kind === 'usb' ||
                iface.displayName.toLowerCase().includes('iphone') ||
                iface.device.toLowerCase().includes('en5')
              const isWifi =
                iface.kind === 'wifi' || iface.displayName.toLowerCase().includes('wi-fi')
              const Icon = isIphone ? Smartphone : isWifi ? Wifi : Radio
              const hasIp = iface.addresses && iface.addresses.length > 0
              const ipv4 = iface.addresses?.find(
                (a) => a.family === 4 || (a.family as unknown as string) === 'IPv4'
              )
              const ip = ipv4?.address || (hasIp ? iface.addresses[0].address : 'No IP assigned')
              const isHealthy = metric ? metric.status !== 'offline' : hasIp
              const liveDownSpeed = metric?.downloadSpeedBytesPerSec || 0
              const liveUpSpeed = metric?.uploadSpeedBytesPerSec || 0
              const weight = metric?.weight ?? 50

              return (
                <div
                  key={iface.id}
                  className={`rounded-2xl border p-3.5 transition-all flex flex-col justify-between ${
                    hasIp
                      ? 'border-border/80 bg-card/75 shadow-sm'
                      : 'border-dashed border-border/50 bg-card/30 opacity-70'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                            isIphone
                              ? 'bg-amber-500/15 text-amber-500'
                              : isWifi
                                ? 'bg-teal-500/15 text-teal-500'
                                : 'bg-emerald-500/15 text-emerald-500'
                          }`}
                        >
                          <Icon className="h-4.5 w-4.5" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <span className="font-bold text-xs">
                              {iface.displayName || iface.device}
                            </span>
                            <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.2 rounded">
                              {iface.device}
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                            {ip}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end">
                        <span
                          className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            hasIp && isHealthy
                              ? 'bg-emerald-500/15 text-emerald-500'
                              : 'bg-amber-500/15 text-amber-500'
                          }`}
                        >
                          {hasIp && isHealthy ? (
                            <>
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Ready
                            </>
                          ) : (
                            <>
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Inactive
                            </>
                          )}
                        </span>
                        {metric && hasIp && (
                          <span className="text-[10.5px] text-muted-foreground mt-1 font-mono">
                            {metric.latencyMs < 999 ? `${metric.latencyMs}ms RTT` : 'Active'}
                          </span>
                        )}
                      </div>
                    </div>

                    {hasIp ? (
                      <div className="mt-3 pt-2.5 border-t border-border/40 space-y-2">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground text-[10px] block">
                              Live Speed
                            </span>
                            <span className="font-semibold font-mono text-foreground">
                              {formatSpeed(liveDownSpeed, speedUnit)}
                            </span>
                            {liveUpSpeed > 0 && (
                              <span className="text-[10px] text-muted-foreground block font-mono">
                                ↑ {formatSpeed(liveUpSpeed, speedUnit)}
                              </span>
                            )}
                          </div>
                          <div>
                            <span className="text-muted-foreground text-[10px] block">
                              Traffic Share
                            </span>
                            <span className="font-semibold font-mono text-foreground">
                              {weight}%
                            </span>
                          </div>
                        </div>

                        {/* Visual Traffic Distribution Bar */}
                        <div className="h-1.5 w-full bg-muted/60 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 rounded-full ${
                              isIphone ? 'bg-amber-500' : 'bg-teal-500'
                            }`}
                            style={{ width: `${weight}%` }}
                          />
                        </div>
                      </div>
                    ) : isIphone ? (
                      <div className="mt-2.5 pt-2 border-t border-border/40 text-[10.5px] text-amber-500/90 leading-tight">
                        Tip: In macOS <strong>System Settings › Network › iPhone USB</strong>, turn
                        off <strong>&ldquo;Disable unless needed&rdquo;</strong> so macOS keeps
                        tethering active alongside Wi-Fi.
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 3. INTEGRATED BONDED DOWNLOAD ACCELERATOR & TRANSFERS */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Bonded Download Accelerator & Transfers
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                Multi-Link Turbo
              </span>
            </div>

            <button
              onClick={() => openNewDownload()}
              className="flex items-center space-x-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90 active:scale-95 transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Download</span>
            </button>
          </div>

          {/* Quick Download Input Bar */}
          <div className="flex items-center space-x-2 rounded-2xl border border-border/80 bg-card/60 p-2 shadow-sm">
            <input
              type="text"
              value={quickUrl}
              onChange={(e) => setQuickUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleQuickDownload()
              }}
              placeholder="Paste file URL, magnet link, or drop .torrent..."
              className="flex-1 bg-transparent px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none font-mono"
            />
            <button
              onClick={() => void handlePasteClipboard()}
              className="flex items-center space-x-1 rounded-xl border border-border/70 bg-card hover:bg-accent px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-all shrink-0"
              title="Paste from clipboard"
            >
              <ClipboardPaste className="h-3.5 w-3.5" />
              <span>Paste</span>
            </button>
            <button
              onClick={handleQuickDownload}
              disabled={!quickUrl.trim()}
              className="flex items-center space-x-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:hover:bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition-all shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Accelerate</span>
            </button>
          </div>

          {/* Active Downloads List or High-Tech Drop Zone */}
          {activeDownloads.length > 0 ? (
            <div className="space-y-2.5">
              {activeDownloads.map((dl) => {
                const percent =
                  dl.totalBytes > 0 ? Math.round((dl.bytesDownloaded / dl.totalBytes) * 100) : 0
                const isPaused = dl.status === 'paused'

                return (
                  <div
                    key={dl.id}
                    className="rounded-2xl border border-border/80 bg-card/75 p-3.5 shadow-sm space-y-2.5 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center space-x-3 min-w-0">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                            dl.status === 'downloading'
                              ? 'bg-emerald-500/15 text-emerald-500'
                              : 'bg-amber-500/15 text-amber-500'
                          }`}
                        >
                          <Download
                            className={`h-4.5 w-4.5 ${
                              dl.status === 'downloading' ? 'animate-bounce' : ''
                            }`}
                          />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-foreground truncate">
                            {dl.fileName}
                          </h4>
                          <div className="flex items-center space-x-2 text-[11px] text-muted-foreground font-mono mt-0.5">
                            <span>{formatBytes(dl.bytesDownloaded)}</span>
                            {dl.totalBytes > 0 && <span>/ {formatBytes(dl.totalBytes)}</span>}
                            <span>•</span>
                            <span className="font-bold text-foreground">
                              {formatSpeed(dl.speedBytesPerSec, speedUnit)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1.5 shrink-0">
                        <button
                          onClick={() => void handlePauseResume(dl.id, isPaused)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/70 hover:bg-accent text-foreground"
                          title={isPaused ? 'Resume download' : 'Pause download'}
                        >
                          {isPaused ? (
                            <Play className="h-3.5 w-3.5" />
                          ) : (
                            <Pause className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => void handleReveal(dl.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/70 hover:bg-accent text-foreground"
                          title="Show in Finder"
                        >
                          <FolderOpen className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => void handleCancel(dl.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/70 hover:bg-rose-500/10 hover:text-rose-500 text-muted-foreground"
                          title="Cancel download"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar & Networks Attribution */}
                    <div className="space-y-1.5">
                      <div className="h-2 w-full bg-muted/60 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300 rounded-full"
                          style={{ width: `${Math.max(2, Math.min(100, percent))}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10.5px] text-muted-foreground font-mono">
                        <div className="flex items-center space-x-1.5">
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded bg-muted text-[10px]">
                            {dl.networks.filter((n) => n.enabled).length} bonded links active
                          </span>
                        </div>
                        <span className="font-bold text-foreground">{percent}%</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/70 bg-card/30 p-5 text-center space-y-2">
              <div className="flex justify-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground">
                  <Download className="h-5 w-5" />
                </div>
              </div>
              <p className="text-xs font-semibold text-foreground">No active downloads right now</p>
              <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                Paste any download URL, magnet link, or drop a .torrent file to accelerate it
                simultaneously across Wi-Fi and iPhone USB.
              </p>
              <div className="pt-1 flex items-center justify-center gap-2">
                <button
                  onClick={() => openNewDownload()}
                  className="rounded-xl border border-border/80 bg-card hover:bg-accent px-3 py-1.5 text-xs font-medium text-foreground transition-all"
                >
                  Open Download Dialog
                </button>
              </div>
            </div>
          )}

          {/* Recently Completed Downloads Strip */}
          {completedDownloads.length > 0 && (
            <div className="rounded-xl border border-border/50 bg-card/40 p-3 space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Recent Completed Transfers
              </div>
              <div className="space-y-1">
                {completedDownloads.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between text-xs py-1 px-2 rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center space-x-2 truncate max-w-[70%]">
                      <FileText className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span className="truncate font-medium">{item.fileName}</span>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0">
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {formatBytes(item.totalBytes)}
                      </span>
                      <button
                        onClick={() => void handleReveal(item.id)}
                        className="text-[11px] text-blue-500 hover:underline"
                      >
                        Show
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 4. BONDING & BALANCING STRATEGY */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Bonding & Balancing Strategy
          </h3>
          <div className="grid grid-cols-2 gap-2.5">
            {strategies.map((strat) => {
              const selected = strategy === strat.id
              const Icon = strat.icon

              return (
                <button
                  key={strat.id}
                  onClick={() => void setBondingStrategy(strat.id)}
                  className={`flex text-left p-3 rounded-2xl border transition-all ${
                    selected
                      ? 'border-emerald-500/60 bg-emerald-500/5 ring-1 ring-emerald-500/30'
                      : 'border-border/70 bg-card/40 hover:bg-card/70'
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl mr-2.5 ${
                      selected ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-xs flex items-center space-x-1.5">
                      <span>{strat.title}</span>
                      {selected && (
                        <span className="text-[9.5px] text-emerald-500 font-bold uppercase">
                          (Active)
                        </span>
                      )}
                    </div>
                    <p className="text-[10.5px] text-muted-foreground mt-0.5 leading-snug">
                      {strat.desc}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* 5. ACTIVE MULTI-NETWORK FLOWS INSPECTOR */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Active Multi-Network Flows
            </h3>
            <span className="text-[11px] text-muted-foreground font-mono">
              {recentFlows.filter((f) => f.active).length} concurrent streams
            </span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/40 shadow-sm">
            {recentFlows.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                {active
                  ? 'Connections idle. Click "Benchmark Speed" above, start a download, or browse the web to see real-time multi-network traffic.'
                  : 'Activate bonding above to start combining network connections.'}
              </div>
            ) : (
              <div className="max-h-44 overflow-y-auto divide-y divide-border/40 text-xs">
                {recentFlows.slice(0, 15).map((flow) => (
                  <div
                    key={flow.id}
                    className="flex items-center justify-between px-3.5 py-2 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center space-x-2 truncate max-w-[65%]">
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 ${
                          flow.active ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/40'
                        }`}
                      />
                      <span className="font-mono truncate font-medium text-foreground text-[11.5px]">
                        {flow.host}:{flow.port}
                      </span>
                      <span className="text-[9.5px] uppercase font-bold text-muted-foreground bg-muted px-1.5 py-0.2 rounded">
                        {flow.protocol}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2.5 shrink-0">
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {formatBytes(flow.bytesTransferred)}
                      </span>
                      <span className="inline-flex items-center text-[10px] font-medium bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-full font-mono">
                        {flow.interfaceName}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 6. SYSTEM SETTINGS FOOTER */}
        <div className="rounded-xl border border-border/40 bg-muted/20 p-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>Need to tweak adapter priority or tethering settings?</span>
          <button
            onClick={() => void (window.velnqor || window.plexo)?.openNetworkSettings?.()}
            className="flex items-center space-x-1 text-foreground hover:underline font-medium"
          >
            <span>Open macOS Network Settings</span>
            <ExternalLink className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  )
}
