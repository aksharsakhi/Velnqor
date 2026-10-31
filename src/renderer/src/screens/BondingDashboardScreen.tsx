import React, { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  ExternalLink,
  Gauge,
  Globe,
  Layers,
  Plus,
  Radio,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Wifi,
  X,
  Zap
} from 'lucide-react'
import type { BondingStrategy } from '@shared/bondingTypes'
import { useAppStore } from '../store/useAppStore'
import { formatBytes } from '../utils/format'
import { useDownloadActions, useDownloadActionsState } from '../components/downloadActionsContext'
import { ACTION_META, toolbarLabel } from '../components/downloadActionMeta'
import { MoreActionsMenu } from '../components/MoreActionsMenu'
import { DownloadFilterMenu } from '../components/DownloadFilterMenu'
import { LimitsDialog } from '../components/LimitsDialog'
import { ScheduleIndicator } from '../components/ScheduleIndicator'
import { NetworksMenu } from '../components/NetworksMenu'
import { Button } from '../components/ui/button'
import { Checkbox } from '../components/ui/checkbox'
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip'
import { useNetworkVisuals } from '../hooks/useNetworkVisuals'
import { availableActions, isFinished, splitToolbar } from '../utils/downloadActions'
import { EmptyState, ListedDownload } from './DownloadsScreen'
import { filterOf, groupLabelClass, groupsOf, NOT_CHOSEN, summaryOf } from '../utils/downloadGroups'

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
    interfacesStatus,
    loadInterfaces,
    speedUnit,
    downloads: downloadsById,
    history,
    openNewDownload,
    setView,
    downloadFilter: filter,
    setDownloadFilter: setFilter
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
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const { perform, askClearFinished } = useDownloadActions()
  const { busy } = useDownloadActionsState()
  const [limitsOpen, setLimitsOpen] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)
  const [limitsPage, setLimitsPage] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(interval)
  }, [])

  const activeInterfaces = interfaces.filter((i) => i.addresses && i.addresses.length > 0)

  const downloadsList = Object.values(downloadsById ?? {})
    .filter((download) => download && download.status !== 'cancelled')
    .sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0))
  const allGroups = groupsOf(downloadsList, history ?? [])
  const allItems = allGroups.flatMap((group) => group.items)
  const counts: Record<import('../store/useAppStore').DownloadFilter, number> = {
    all: allItems.length,
    progress: 0,
    finished: 0,
    failed: 0
  }
  for (const item of allItems) counts[filterOf(item)]++
  const groups = allGroups.filter(
    (group) => filter === 'all' || filterOf(group.items[0]) === filter
  )
  const items = groups.flatMap((group) => group.items)
  const chosen = items.filter((item) => selected.has(item.id))

  const toggle = useCallback(
    (ids: string[], on: boolean): void =>
      setSelected((previous) => {
        const next = new Set(previous)
        for (const id of ids) {
          if (on) next.add(id)
          else next.delete(id)
        }
        return next
      }),
    []
  )

  const networkVisual = useNetworkVisuals()
  const selectRow = useCallback((id: string, on: boolean) => toggle([id], on), [toggle])
  const openRow = useCallback((id: string) => setView({ name: 'download', id }), [setView])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target
      if (
        event.defaultPrevented ||
        (target instanceof HTMLElement &&
          (target.isContentEditable || ['INPUT', 'TEXTAREA'].includes(target.tagName))) ||
        document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]')
      )
        return
      const command = window.plexo.platform === 'darwin' ? event.metaKey : event.ctrlKey
      if (event.key === 'Escape') setSelected(new Set())
      else if (command && event.key.toLowerCase() === 'a') {
        event.preventDefault()
        setSelected(new Set(items.map((item) => item.id)))
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        const id = command ? 'trash' : 'remove'
        const action = availableActions(chosen)
          .flat()
          .find((available) => available.id === id)
        if (!action) return
        event.preventDefault()
        void perform(id, action.targets)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [items, chosen, perform])

  const { buttons: toolbarButtons, more: moreActions } = splitToolbar(availableActions(chosen))

  const openSchedule = (): void => {
    setLimitsPage(null)
    setShowSchedule(true)
    setLimitsOpen(true)
  }

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

  return (
    <div className="flex h-full flex-col text-foreground select-none overflow-hidden bg-background">
      {/* 1. LIQUID GLASS COMMAND BAR (Functional Floating Layer) */}
      <div className="shrink-0 border-b border-border/70 bg-card/75 px-6 py-3.5 backdrop-blur-xl shadow-xs">
        <div className="flex flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5 min-w-0">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-inner transition-transform duration-160 ease-out ${
                active
                  ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/40 shadow-emerald-500/10'
                  : 'bg-muted/70 text-muted-foreground'
              }`}
            >
              <Zap className={`h-5 w-5 ${active ? 'fill-emerald-400/20' : ''}`} />
            </div>
            <div className="truncate">
              <div className="flex items-center space-x-2">
                <h2 className="text-[14.5px] font-bold tracking-tight text-foreground truncate">
                  System-Wide Multi-WAN Bonding
                </h2>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide ${
                    active
                      ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/40'
                      : 'bg-muted text-muted-foreground ring-1 ring-border'
                  }`}
                >
                  <span
                    className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
                      active ? 'bg-emerald-400 animate-pulse' : 'bg-muted-foreground'
                    }`}
                  />
                  {active ? 'Engine Active' : 'Standby'}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                Bonding {activeInterfaces.length} active connection
                {activeInterfaces.length === 1 ? '' : 's'} (Wi-Fi + iPhone USB + Ethernet) into
                unified high-speed bandwidth.
              </p>
            </div>
          </div>

          {/* Header Action Controls: Proxy Switch + Benchmark + Primary Bonding Button */}
          <div className="flex items-center space-x-2.5 shrink-0">
            <button
              onClick={() => void toggleSystemProxy()}
              className={`flex items-center space-x-2 rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-2xs transition-all active:scale-97 ${
                systemProxyActive
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
                  : 'border-border/80 bg-card/60 hover:bg-card text-muted-foreground hover:text-foreground'
              }`}
              title="Route all Mac browser & app traffic through bonded tunnel"
            >
              <Globe
                className={`h-3.5 w-3.5 ${systemProxyActive ? 'text-emerald-400' : 'text-muted-foreground'}`}
              />
              <span>{systemProxyActive ? '✓ Mac Proxy On' : 'Route Mac Traffic'}</span>
            </button>

            <button
              onClick={() => void handleTestSpeed()}
              disabled={isSpeedTesting}
              className={`flex items-center space-x-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-2xs transition-all active:scale-97 disabled:opacity-50 ${
                isSpeedTesting
                  ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-400'
                  : 'border-border/80 bg-card/60 hover:bg-card text-foreground'
              }`}
            >
              <Gauge
                className={`h-3.5 w-3.5 text-cyan-400 ${isSpeedTesting ? 'animate-spin' : ''}`}
              />
              <span>{isSpeedTesting ? 'Benchmarking...' : 'Benchmark Speed'}</span>
            </button>

            <button
              onClick={() => void toggleBonding()}
              className={`flex items-center justify-center rounded-xl px-4 py-1.5 text-xs font-bold shadow-xs transition-all active:scale-97 ${
                active
                  ? 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40 hover:bg-rose-500/30'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold shadow-emerald-500/20'
              }`}
            >
              {active ? 'Stop Bonding' : 'Activate Bonding'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-2.5 flex items-center space-x-2 text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/30">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* 2. SCROLLABLE UNIFIED BODY */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-5 pb-14 space-y-6 text-foreground">
        {/* Real-Time Aggregate Speedometer Cards with Tabular Numbers */}
        <div className="grid grid-cols-2 gap-4">
          {/* Download Card */}
          <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-b from-card/80 to-card/40 p-4.5 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <ArrowDown className="h-4 w-4 text-emerald-400" />
                <span>Aggregate Download</span>
              </div>
              <div className="h-7 w-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <Activity
                  className={`h-3.5 w-3.5 ${totalDownloadSpeed > 0 ? 'animate-pulse' : ''}`}
                />
              </div>
            </div>

            <div className="my-2.5">
              <div className="text-3xl font-black tracking-tight text-foreground font-mono tabular-nums">
                {formatSpeed(totalDownloadSpeed, speedUnit)}
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1.5 border-t border-border/40">
              <span>Aggregated across {activeInterfaces.length} active links</span>
              <span className="font-mono text-foreground font-medium tabular-nums">
                Session: {formatBytes(sessionTotalBytesDown)}
              </span>
            </div>
          </div>

          {/* Upload Card */}
          <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-b from-card/80 to-card/40 p-4.5 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <ArrowUp className="h-4 w-4 text-cyan-400" />
                <span>Aggregate Upload</span>
              </div>
              <div className="h-7 w-7 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                <Radio className={`h-3.5 w-3.5 ${totalUploadSpeed > 0 ? 'animate-pulse' : ''}`} />
              </div>
            </div>

            <div className="my-2.5">
              <div className="text-3xl font-black tracking-tight text-foreground font-mono tabular-nums">
                {formatSpeed(totalUploadSpeed, speedUnit)}
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1.5 border-t border-border/40">
              <span>Multi-WAN Outbound Multiplexing</span>
              <span className="font-mono text-foreground font-medium tabular-nums">
                Session: {formatBytes(sessionTotalBytesUp)}
              </span>
            </div>
          </div>
        </div>

        {/* Detected Hardware Network Adapters */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center space-x-1.5">
              <span>Detected Network Adapters</span>
              <span className="text-[11px] text-muted-foreground font-mono">
                ({interfaces.length} available)
              </span>
            </h3>
            <button
              onClick={() => void loadInterfaces()}
              className="flex items-center space-x-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw
                className={`h-3 w-3 ${interfacesStatus === 'loading' ? 'animate-spin text-emerald-500' : ''}`}
              />
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
              const liveDownSpeed = metric?.downloadSpeedBytesPerSec || 0
              const liveUpSpeed = metric?.uploadSpeedBytesPerSec || 0
              const isLiveActive = liveDownSpeed > 0 || liveUpSpeed > 0
              const isHealthy = hasIp && (isLiveActive || !metric || metric.status !== 'offline')
              const weight = metric?.weight ?? (hasIp ? 50 : 0)

              return (
                <div
                  key={iface.id}
                  className={`rounded-2xl border p-4 transition-all flex flex-col justify-between ${
                    hasIp
                      ? 'border-border/70 bg-card/70 hover:border-border shadow-2xs'
                      : 'border-dashed border-border/50 bg-card/30 opacity-70'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div
                          className={`flex h-9.5 w-9.5 items-center justify-center rounded-xl shadow-xs ${
                            isIphone
                              ? 'bg-amber-500/15 text-amber-400'
                              : isWifi
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-cyan-500/15 text-cyan-400'
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <span className="font-bold text-xs tracking-tight">
                              {iface.displayName || iface.device}
                            </span>
                            <span className="text-[10px] font-mono text-muted-foreground bg-muted/80 px-1.5 py-0.2 rounded-md">
                              {iface.device}
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-foreground font-mono tabular-nums mt-0.5">
                            {ip}
                          </div>
                        </div>
                      </div>

                      {/* Health & Status Badge */}
                      <div className="flex flex-col items-end">
                        <span
                          className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            isLiveActive
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : isHealthy
                                ? 'bg-teal-500/15 text-teal-400 border border-teal-500/30'
                                : 'bg-muted text-muted-foreground border border-border'
                          }`}
                        >
                          {isLiveActive ? (
                            <>
                              <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Active
                            </>
                          ) : isHealthy ? (
                            <>
                              <CheckCircle2 className="h-3 w-3 mr-1 text-teal-400" />
                              Ready
                            </>
                          ) : (
                            <>
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Inactive
                            </>
                          )}
                        </span>
                        {hasIp && (
                          <span className="text-[10px] text-muted-foreground mt-1 font-mono tabular-nums">
                            {metric && metric.latencyMs < 999
                              ? `${metric.latencyMs}ms RTT`
                              : isLiveActive
                                ? 'Bonded Link'
                                : 'Ready'}
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
                            <span className="font-semibold font-mono tabular-nums text-foreground">
                              {formatSpeed(liveDownSpeed, speedUnit)}
                            </span>
                            {liveUpSpeed > 0 && (
                              <span className="text-[10px] text-muted-foreground block font-mono tabular-nums">
                                ↑ {formatSpeed(liveUpSpeed, speedUnit)}
                              </span>
                            )}
                          </div>
                          <div>
                            <span className="text-muted-foreground text-[10px] block">
                              Traffic Share
                            </span>
                            <span className="font-semibold font-mono tabular-nums text-foreground">
                              {weight}%
                            </span>
                          </div>
                        </div>

                        {/* Visual Traffic Distribution Bar */}
                        <div className="h-1.5 w-full bg-muted/60 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ease-out rounded-full ${
                              isIphone ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.max(4, weight)}%` }}
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

        {/* 3. INTEGRATED BONDED DOWNLOAD ACCELERATOR & TRANSFERS QUEUE */}
        <div className="space-y-3 pt-2 border-t border-border/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Bonded Transfers & Download Accelerator
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                Multi-Link Turbo
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <ScheduleIndicator onClick={openSchedule} />
              <NetworksMenu
                onOpenLimits={(page) => {
                  setShowSchedule(false)
                  setLimitsPage(page)
                  setLimitsOpen(true)
                }}
              />
            </div>
          </div>

          {/* Quick Download Input Bar */}
          <div className="flex items-center space-x-2 rounded-2xl border border-border/80 bg-card/60 p-2 shadow-2xs focus-within:border-emerald-500/60 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
            <input
              type="text"
              aria-label="Quick download URL"
              value={quickUrl}
              onChange={(e) => setQuickUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleQuickDownload()
              }}
              placeholder="Paste URL, magnet, or drop file to accelerate with Multi-WAN bonding..."
              className="flex-1 bg-transparent px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none font-mono tracking-tight"
            />
            <button
              onClick={() => void handlePasteClipboard()}
              className="flex items-center space-x-1.5 rounded-xl border border-border/70 bg-card hover:bg-accent px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground active:scale-95 transition-all shrink-0 shadow-2xs"
              title="Paste from clipboard"
            >
              <ClipboardPaste className="h-3.5 w-3.5" />
              <span>Paste</span>
            </button>
            <button
              onClick={handleQuickDownload}
              disabled={!quickUrl.trim()}
              className="flex items-center space-x-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:hover:bg-emerald-500 px-4 py-1.5 text-xs font-bold text-neutral-950 shadow-xs active:scale-95 transition-all shrink-0"
            >
              <Zap className="h-3.5 w-3.5" />
              <span>Accelerate</span>
            </button>
          </div>

          {/* Filter & Batch Actions Toolbar */}
          <div className="rounded-xl border border-border/60 bg-card/40 p-1.5">
            {chosen.length === 0 ? (
              <div className="flex h-10 items-center gap-3 px-2">
                <DownloadFilterMenu
                  value={filter}
                  counts={counts}
                  onChange={(next) => {
                    setFilter(next)
                    setSelected(new Set())
                  }}
                />
                {allGroups.length > 1 && (
                  <div className="font-mono text-[11px] leading-none text-muted-foreground">
                    {summaryOf(downloadsList)}
                  </div>
                )}
                <div className="flex-1" />
                <Button type="button" size="sm" variant="ghost" onClick={() => openNewDownload()}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  New download
                </Button>
              </div>
            ) : (
              <div
                role="toolbar"
                aria-label="Selected downloads"
                aria-busy={busy}
                className="flex h-10 items-center gap-3 px-2"
              >
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Deselect all"
                        disabled={busy}
                        onClick={() => setSelected(new Set())}
                      >
                        <X />
                      </Button>
                    }
                  />
                  <TooltipContent>Deselect all</TooltipContent>
                </Tooltip>
                <span className="shrink-0 whitespace-nowrap text-[13px] font-semibold">
                  {chosen.length} selected
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy || chosen.length === items.length}
                  onClick={() => setSelected(new Set(items.map((item) => item.id)))}
                >
                  Select all
                </Button>
                <div className="flex-1" />
                <div className="flex min-w-0 items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {toolbarButtons.map(({ id, targets }) => (
                    <Button
                      key={id}
                      type="button"
                      size="sm"
                      variant={ACTION_META[id].destructive ? 'destructive' : 'secondary'}
                      disabled={busy}
                      onClick={() => void perform(id, targets)}
                    >
                      {toolbarLabel(id, targets.length)}
                    </Button>
                  ))}
                  <MoreActionsMenu groups={moreActions} disabled={busy} />
                </div>
              </div>
            )}
          </div>

          {/* Downloads List or Empty State */}
          <div className="space-y-4">
            {groups.length === 0 &&
              (filter === 'all' ? (
                <EmptyState />
              ) : (
                <div
                  role="status"
                  className="flex flex-col items-center gap-2 px-5 py-12 text-center"
                >
                  <p className="text-[15px] font-semibold">
                    {filter === 'progress'
                      ? 'No downloads in progress'
                      : filter === 'finished'
                        ? 'No finished downloads'
                        : 'No downloads need attention'}
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setFilter('all')}
                  >
                    Show all downloads
                  </Button>
                </div>
              ))}
            {groups.map((group) => {
              const ids = group.items.map((item) => item.id)
              const all = ids.every((id) => selected.has(id))
              const some = !all && ids.some((id) => selected.has(id))
              return (
                <section
                  key={group.label}
                  aria-label={group.label}
                  className="rounded-2xl border border-border/70 bg-card/60 p-3 shadow-xs"
                >
                  <div className="flex items-center gap-3 border-b-[0.5px] border-border pb-2.5">
                    <Checkbox
                      aria-label={
                        group.label === 'Needs attention'
                          ? 'Select all downloads needing attention'
                          : `Select all ${group.label.toLowerCase()} downloads`
                      }
                      checked={all}
                      indeterminate={some}
                      onCheckedChange={(on) => toggle(ids, on)}
                    />
                    <h2 className={groupLabelClass}>
                      {group.label}
                      <span className="ml-2.5 tracking-normal font-sans font-bold">
                        {group.items.length}
                      </span>
                    </h2>
                    <div className="flex-1" />
                    {group.label === 'Finished' && history.length > 0 && (
                      <button
                        type="button"
                        className="text-[11.5px] text-muted-foreground hover:text-foreground transition-colors"
                        onClick={askClearFinished}
                      >
                        Clear finished list
                      </button>
                    )}
                  </div>
                  <div className="divide-y divide-border/30 pt-1">
                    {group.items.map((item) => (
                      <ListedDownload
                        key={item.id}
                        item={item}
                        now={now}
                        selected={selected.has(item.id)}
                        chosen={selected.has(item.id) ? chosen : NOT_CHOSEN}
                        networkVisual={
                          isFinished(item) || item.status === 'completed'
                            ? undefined
                            : networkVisual
                        }
                        onSelect={selectRow}
                        onOpen={openRow}
                        onPerform={perform}
                      />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        </div>

        {/* 4. BONDING STRATEGY & FLOW TELEMETRY (Collapsible Accordion) */}
        <div className="rounded-2xl border border-border/70 bg-card/50 overflow-hidden shadow-xs">
          <button
            type="button"
            onClick={() => setShowAdvanced((prev) => !prev)}
            className="w-full flex items-center justify-between p-4 hover:bg-muted/40 transition-colors text-left"
          >
            <div className="flex items-center space-x-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Layers className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Bonding Engine Strategy & Live Socket Telemetry
                </h4>
                <span className="text-[11px] text-muted-foreground mt-0.5 block">
                  Current:{' '}
                  <strong className="text-foreground capitalize">
                    {strategy.replace('_', ' ')}
                  </strong>{' '}
                  · {recentFlows.filter((f) => f.active).length} concurrent streams
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-1.5 text-xs text-muted-foreground">
              <span>{showAdvanced ? 'Hide Advanced' : 'Configure Strategy'}</span>
              {showAdvanced ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </div>
          </button>

          {showAdvanced && (
            <div className="p-4 pt-1 space-y-5 border-t border-border/40">
              {/* Bonding Strategies Cards */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Multipath Routing Algorithm
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {strategies.map((strat) => {
                    const isStratActive = strategy === strat.id
                    const StratIcon = strat.icon

                    return (
                      <button
                        key={strat.id}
                        onClick={() => void setBondingStrategy(strat.id)}
                        className={`flex text-left p-3 rounded-2xl border transition-all ${
                          isStratActive
                            ? 'border-emerald-500/60 bg-emerald-500/5 ring-1 ring-emerald-500/30'
                            : 'border-border/70 bg-card/40 hover:bg-card/70'
                        }`}
                      >
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl mr-2.5 ${
                            isStratActive
                              ? 'bg-emerald-500 text-white'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          <StratIcon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-semibold text-xs flex items-center space-x-1.5">
                            <span>{strat.title}</span>
                            {isStratActive && (
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

              {/* Active Multi-Network Flows Inspector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Active Multi-Network Flows
                  </div>
                  <span className="text-[10.5px] text-muted-foreground font-mono">
                    {recentFlows.filter((f) => f.active).length} concurrent streams
                  </span>
                </div>

                <div className="overflow-hidden rounded-xl border border-border/70 bg-card/40 shadow-xs">
                  {recentFlows.length === 0 ? (
                    <div className="py-5 text-center text-xs text-muted-foreground">
                      {active
                        ? 'Connections idle. Benchmark speed, start a transfer, or browse the web to see real-time multiplexed traffic.'
                        : 'Activate bonding above to start combining network connections.'}
                    </div>
                  ) : (
                    <div className="max-h-40 overflow-y-auto divide-y divide-border/40 text-xs">
                      {recentFlows.slice(0, 15).map((flow) => (
                        <div
                          key={flow.id}
                          className="flex items-center justify-between px-3.5 py-1.5 hover:bg-muted/40 transition-colors"
                        >
                          <div className="flex items-center space-x-2 truncate max-w-[65%]">
                            <span
                              className={`h-2 w-2 rounded-full shrink-0 ${
                                flow.active
                                  ? 'bg-emerald-500 animate-pulse'
                                  : 'bg-muted-foreground/40'
                              }`}
                            />
                            <span className="font-mono truncate font-medium text-foreground text-[11px]">
                              {flow.host}:{flow.port}
                            </span>
                            <span className="text-[9px] uppercase font-bold text-muted-foreground bg-muted px-1.5 py-0.2 rounded">
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
            </div>
          )}
        </div>

        {/* 5. SYSTEM SETTINGS FOOTER */}
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

      <LimitsDialog
        open={limitsOpen}
        showSchedule={showSchedule}
        onOpenChange={setLimitsOpen}
        page={limitsPage}
        onPageChange={setLimitsPage}
      />
    </div>
  )
}
