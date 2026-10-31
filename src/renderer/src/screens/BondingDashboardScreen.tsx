import React, { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  ClipboardPaste,
  FolderOpen,
  Gauge,
  Globe,
  Layers,
  Network,
  Plus,
  Power,
  Radio,
  RefreshCw,
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
import { Switch } from '../components/ui/switch'

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

/**
 * State-of-the-Art Apple macOS Pro Dashboard for Velnqor:
 * - Designed from scratch according to Apple Human Interface Guidelines and Emil Kowalski interaction engineering
 * - 4 Focused Workspaces:
 *   1. ⚡ Multi-WAN Studio: Hero dynamic circular speed halo, master bonding trigger, live multipath rails
 *   2. 📥 Transfers & Turbo: Bonded download accelerator, batch selection toolbar, multi-network chunk progress
 *   3. 🌐 Network Adapters: Real-time hardware topology, traffic distribution weights, and latency benchmarks
 *   4. ⚙️ Preferences: System settings, bandwidth limits, storage usage, and proxy ports
 */
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
    setSpeedUnit,
    downloads: downloadsById,
    history,
    openNewDownload,
    setView,
    activeTab,
    setActiveTab,
    downloadFilter: filter,
    setDownloadFilter: setFilter,
    slowMode,
    setSlowMode,
    destinationDir,
    setDestinationDir,
    downloadsAtOnce,
    setDownloadsAtOnce
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
    error
  } = bondingState

  const [quickUrl, setQuickUrl] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const { perform, askClearFinished } = useDownloadActions()
  const { busy } = useDownloadActionsState()
  const [limitsOpen, setLimitsOpen] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)
  const [limitsPage, setLimitsPage] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [freeDisk, setFreeDisk] = useState<number | null>(null)

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    void window.plexo
      ?.freeSpace?.(destinationDir)
      ?.then((bytes) => setFreeDisk(bytes))
      ?.catch(() => {})
  }, [destinationDir])

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

  const handleQuickDownload = (): void => {
    if (!quickUrl.trim()) return
    const url = quickUrl.trim()
    setQuickUrl('')
    openNewDownload(url)
  }

  const handlePasteClipboard = async (): Promise<void> => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) setQuickUrl(text)
    } catch {
      // ignore
    }
  }

  const handlePickDirectory = async (): Promise<void> => {
    try {
      const picked = await window.plexo?.chooseDestinationFolder?.(destinationDir)
      if (picked) setDestinationDir(picked)
    } catch {
      // ignore
    }
  }

  const activeDownloads = downloadsList.filter(
    (d) => d.status === 'downloading' || d.status === 'queued'
  )

  const openSchedule = (): void => {
    setLimitsPage(null)
    setShowSchedule(true)
    setLimitsOpen(true)
  }

  const actions = availableActions(chosen)
  const { buttons: toolbarButtons, more: moreActions } = splitToolbar(actions)

  // Rotating angle for speed halo visualizer
  const downloadNormalized = Math.min(
    100,
    Math.round((totalDownloadSpeed / (50 * 1024 * 1024)) * 100)
  )
  const haloCircumference = 2 * Math.PI * 80
  const haloOffset = haloCircumference - (downloadNormalized / 100) * haloCircumference

  return (
    <div className="flex h-full flex-col text-foreground select-none overflow-hidden bg-background">
      {/* Scrollable Stage Body */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {/* Error notification banner if any */}
        {error && (
          <div className="flex items-center space-x-2 text-xs text-rose-400 bg-rose-500/10 p-3 rounded-2xl border border-rose-500/30 shadow-xs">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* =========================================================================
            TAB 1: ⚡ MULTI-WAN STUDIO (Hero Interactive Command Center)
            ========================================================================= */}
        {activeTab === 'bonding' && (
          <div className="space-y-6">
            {/* Hero Interactive Multi-WAN Speed Halo Card */}
            <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-b from-card/90 via-card/60 to-card/30 p-8 shadow-xs backdrop-blur-xl">
              {/* Subtle ambient radial glow when active */}
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-emerald-500/15 blur-3xl pointer-events-none -z-10 rounded-full" />
              )}

              <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                {/* Left: Dynamic Circular Speed Halo */}
                <div className="flex items-center space-x-8">
                  <div className="relative flex items-center justify-center">
                    <svg className="w-44 h-44 -rotate-90 transform" viewBox="0 0 180 180">
                      {/* Background Track */}
                      <circle
                        cx="90"
                        cy="90"
                        r="80"
                        className="stroke-muted/50 fill-none"
                        strokeWidth="10"
                      />
                      {/* Animated Emerald Active Arc */}
                      <circle
                        cx="90"
                        cy="90"
                        r="80"
                        className="stroke-emerald-400 fill-none transition-all duration-300 ease-out"
                        strokeWidth="10"
                        strokeDasharray={haloCircumference}
                        strokeDashoffset={haloOffset}
                        strokeLinecap="round"
                      />
                    </svg>

                    {/* Central Speed Data Metric */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Aggregate
                      </div>
                      <div className="font-mono text-3xl font-black tracking-tight text-foreground tabular-nums my-0.5">
                        {formatSpeed(totalDownloadSpeed, speedUnit)}
                      </div>
                      <div className="flex items-center space-x-1 text-[11px] font-mono text-cyan-400 font-semibold tabular-nums">
                        <span>↑</span>
                        <span>{formatSpeed(totalUploadSpeed, speedUnit)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Halo Stats Context */}
                  <div className="space-y-2">
                    <div className="inline-flex items-center space-x-2 rounded-full px-3 py-1 text-xs font-semibold bg-card border border-border/60 shadow-2xs">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          active ? 'bg-emerald-400 animate-pulse' : 'bg-muted-foreground/60'
                        }`}
                      />
                      <span className="text-foreground">
                        {active ? 'Multipath Engine Active' : 'Multi-WAN Standby'}
                      </span>
                    </div>

                    <h1 className="text-2xl font-black tracking-tight text-foreground">
                      Multi-Network Multiplexing
                    </h1>
                    <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
                      Bonding {activeInterfaces.length} active connection
                      {activeInterfaces.length === 1 ? '' : 's'} (Wi-Fi + iPhone USB Tethering +
                      Ethernet) into unified ultra-low-latency bandwidth.
                    </p>

                    <div className="flex items-center space-x-4 pt-1 text-[11px] text-muted-foreground font-mono">
                      <span>
                        Session Down:{' '}
                        <strong className="text-foreground font-bold tabular-nums">
                          {formatBytes(sessionTotalBytesDown)}
                        </strong>
                      </span>
                      <span>·</span>
                      <span>
                        Session Up:{' '}
                        <strong className="text-foreground font-bold tabular-nums">
                          {formatBytes(sessionTotalBytesUp)}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Master Bonding Trigger Button */}
                <div className="flex flex-col items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => void toggleBonding()}
                    className={`flex items-center space-x-2.5 rounded-2xl px-6 py-4 text-sm font-black tracking-wide shadow-md transition-all active:scale-95 ${
                      active
                        ? 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40 hover:bg-rose-500/30'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-neutral-950 shadow-emerald-500/25 ring-2 ring-emerald-400/30'
                    }`}
                  >
                    <Power className="h-5 w-5" />
                    <span>
                      {active ? 'Disengage Multi-WAN Bonding' : 'Engage Multi-WAN Bonding'}
                    </span>
                  </button>
                  <span className="text-[11px] text-muted-foreground text-center">
                    Instant zero-drop failover protection
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Control Center: Proxy Switch + Benchmark + Multipath Algorithm */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Card 1: Route All Mac Traffic */}
              <div className="rounded-2xl border border-border/70 bg-card/70 p-4.5 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                        systemProxyActive
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <Globe className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-foreground">Route Mac Traffic</h3>
                      <p className="text-[10.5px] text-muted-foreground">Tunnel all macOS apps</p>
                    </div>
                  </div>

                  <Switch
                    checked={systemProxyActive}
                    onCheckedChange={() => void toggleSystemProxy(!systemProxyActive)}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-3 pt-2.5 border-t border-border/40 leading-snug">
                  Accelerates browsers, terminals, App Store, and sync services through the bonded
                  pipeline.
                </p>
              </div>

              {/* Card 2: Benchmark Speed & Latency */}
              <div className="rounded-2xl border border-border/70 bg-card/70 p-4.5 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-400">
                      <Gauge className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-foreground">Speed Benchmark</h3>
                      <p className="text-[10.5px] text-muted-foreground">Ping & Bandwidth Test</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void runSpeedTest()}
                    disabled={isSpeedTesting}
                    className="flex items-center space-x-1.5 rounded-xl border border-border/70 bg-card hover:bg-accent px-3 py-1.5 text-xs font-semibold active:scale-95 transition-all disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`h-3 w-3 ${isSpeedTesting ? 'animate-spin text-cyan-400' : ''}`}
                    />
                    <span>{isSpeedTesting ? 'Testing...' : 'Test Speed'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-3 pt-2.5 border-t border-border/40 leading-snug">
                  Probes latency across all physical interfaces concurrently to optimize stream
                  routing.
                </p>
              </div>

              {/* Card 3: Multipath Algorithm Selector */}
              <div className="rounded-2xl border border-border/70 bg-card/70 p-4.5 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
                      <Layers className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-foreground">Routing Algorithm</h3>
                      <p className="text-[10.5px] text-muted-foreground capitalize">
                        {strategy.replace('_', ' ')}
                      </p>
                    </div>
                  </div>

                  <select
                    value={strategy}
                    onChange={(e) => void setBondingStrategy(e.target.value as BondingStrategy)}
                    className="rounded-xl border border-border/70 bg-card px-2.5 py-1 text-xs font-semibold text-foreground outline-none cursor-pointer"
                  >
                    <option value="speed_boost">Speed Multiplexer</option>
                    <option value="balanced_rr">Balanced Round-Robin</option>
                    <option value="failover">Resilient Failover</option>
                  </select>
                </div>
                <p className="text-[11px] text-muted-foreground mt-3 pt-2.5 border-t border-border/40 leading-snug">
                  Dynamically balances TCP packets across high-throughput and low-latency paths.
                </p>
              </div>
            </div>

            {/* Live Multipath Hardware Pipelines */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center space-x-2">
                  <span>Multipath Hardware Pipelines</span>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    ({interfaces.length} available)
                  </span>
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('networks')}
                  className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  Configure Hardware Weights →
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
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
                  const liveDown = metric?.downloadSpeedBytesPerSec || 0
                  const liveUp = metric?.uploadSpeedBytesPerSec || 0
                  const weight = metric?.weight ?? (hasIp ? 50 : 0)

                  return (
                    <div
                      key={iface.id}
                      className={`rounded-2xl border p-4 transition-all flex flex-col justify-between ${
                        hasIp
                          ? 'border-border/70 bg-card/70 shadow-2xs'
                          : 'border-dashed border-border/40 bg-card/20 opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-xs ${
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
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-xs tracking-tight text-foreground">
                                {iface.displayName || iface.device}
                              </span>
                              <span className="text-[10px] font-mono text-muted-foreground bg-muted/80 px-1.5 py-0.5 rounded-md">
                                {iface.device}
                              </span>
                            </div>
                            <span className="text-[10.5px] text-muted-foreground">
                              {hasIp ? 'Ready & Bonded' : 'Waiting for connection'}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="font-mono text-xs font-bold text-foreground tabular-nums">
                            {formatSpeed(liveDown, speedUnit)}
                          </span>
                          {liveUp > 0 && (
                            <span className="text-[10px] text-cyan-400 block font-mono tabular-nums">
                              ↑ {formatSpeed(liveUp, speedUnit)}
                            </span>
                          )}
                        </div>
                      </div>

                      {hasIp && (
                        <div className="mt-3 pt-2.5 border-t border-border/40 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>Traffic Share</span>
                            <span className="font-mono font-bold text-foreground tabular-nums">
                              {weight}%
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-muted/60 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ease-out rounded-full ${
                                isIphone ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.max(4, weight)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Quick Turbo Accelerator Bar */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Quick Turbo Accelerator
              </h3>
              <div className="flex items-center space-x-2 rounded-2xl border border-border/80 bg-card/80 p-2 shadow-2xs focus-within:border-emerald-500/60 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
                <input
                  type="text"
                  aria-label="Quick download URL"
                  value={quickUrl}
                  onChange={(e) => setQuickUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleQuickDownload()
                  }}
                  placeholder="Paste URL, magnet, or file link to accelerate with Multi-WAN bonding..."
                  className="flex-1 bg-transparent px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none font-mono"
                />
                <button
                  type="button"
                  onClick={() => void handlePasteClipboard()}
                  className="flex items-center space-x-1.5 rounded-xl border border-border/70 bg-card hover:bg-accent px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground active:scale-95 transition-all shrink-0"
                  title="Paste from clipboard"
                >
                  <ClipboardPaste className="h-3.5 w-3.5" />
                  <span>Paste</span>
                </button>
                <button
                  type="button"
                  onClick={handleQuickDownload}
                  disabled={!quickUrl.trim()}
                  className="flex items-center space-x-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:hover:bg-emerald-500 px-4 py-1.5 text-xs font-bold text-neutral-950 shadow-xs active:scale-95 transition-all shrink-0"
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span>Accelerate</span>
                </button>
              </div>
            </div>

            {/* Active Transfers Preview (If running) */}
            {activeDownloads.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Active Bonded Transfers ({activeDownloads.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('downloads')}
                    className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    View All Transfers →
                  </button>
                </div>
                <div className="rounded-2xl border border-border/70 bg-card/60 divide-y divide-border/30 p-2 shadow-xs">
                  {activeDownloads.map((item) => (
                    <ListedDownload
                      key={item.id}
                      item={item}
                      now={now}
                      selected={selected.has(item.id)}
                      chosen={selected.has(item.id) ? chosen : NOT_CHOSEN}
                      networkVisual={networkVisual}
                      onSelect={selectRow}
                      onOpen={openRow}
                      onPerform={perform}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 2: 📥 TRANSFERS & TURBO (The Complete Downloads Studio)
            ========================================================================= */}
        {activeTab === 'downloads' && (
          <div className="space-y-4">
            {/* Quick Accelerator Bar at Top of Transfers */}
            <div className="flex items-center space-x-2 rounded-2xl border border-border/80 bg-card/80 p-2 shadow-2xs focus-within:border-emerald-500/60 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
              <input
                type="text"
                aria-label="Quick download URL"
                value={quickUrl}
                onChange={(e) => setQuickUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleQuickDownload()
                }}
                placeholder="Paste URL, magnet, or torrent link to accelerate..."
                className="flex-1 bg-transparent px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none font-mono"
              />
              <button
                type="button"
                onClick={() => void handlePasteClipboard()}
                className="flex items-center space-x-1.5 rounded-xl border border-border/70 bg-card hover:bg-accent px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground active:scale-95 transition-all shrink-0"
              >
                <ClipboardPaste className="h-3.5 w-3.5" />
                <span>Paste</span>
              </button>
              <button
                type="button"
                onClick={handleQuickDownload}
                disabled={!quickUrl.trim()}
                className="flex items-center space-x-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 px-4 py-1.5 text-xs font-bold text-neutral-950 shadow-xs active:scale-95 transition-all shrink-0"
              >
                <Zap className="h-3.5 w-3.5" />
                <span>Accelerate</span>
              </button>
            </div>

            {/* Filter & Batch Actions Toolbar */}
            <div className="rounded-2xl border border-border/70 bg-card/60 p-2 shadow-xs">
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
                    <div className="font-mono text-[11px] leading-none text-muted-foreground tabular-nums">
                      {summaryOf(downloadsList)}
                    </div>
                  )}
                  <div className="flex-1" />
                  <ScheduleIndicator onClick={openSchedule} />
                  <NetworksMenu
                    onOpenLimits={(page) => {
                      setShowSchedule(false)
                      setLimitsPage(page)
                      setLimitsOpen(true)
                    }}
                  />
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
                  <span className="shrink-0 whitespace-nowrap text-[13px] font-semibold tabular-nums">
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
                    <div className="flex items-center gap-3 border-b border-border/40 pb-2.5">
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
                        <span className="ml-2.5 tracking-normal font-sans font-bold tabular-nums">
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
        )}

        {/* =========================================================================
            TAB 3: 🌐 NETWORK ADAPTERS (Hardware Topology & Weights)
            ========================================================================= */}
        {activeTab === 'networks' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Hardware Network Adapters
                </h2>
                <p className="text-xs text-muted-foreground">
                  Real-time network physical interfaces, assigned IP addresses, and traffic routing
                  weights.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void loadInterfaces()}
                disabled={interfacesStatus === 'loading'}
                className="flex items-center space-x-1.5 rounded-xl border border-border/70 bg-card hover:bg-accent px-3 py-1.5 text-xs font-semibold active:scale-95 transition-all shadow-2xs"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${interfacesStatus === 'loading' ? 'animate-spin text-emerald-400' : ''}`}
                />
                <span>Rescan Hardware</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {interfaces.map((iface) => {
                const metric = interfaceMetrics[iface.id]
                const isIphone =
                  iface.kind === 'usb' ||
                  iface.displayName.toLowerCase().includes('iphone') ||
                  iface.device.toLowerCase().includes('en5')
                const isWifi =
                  iface.kind === 'wifi' || iface.displayName.toLowerCase().includes('wi-fi')
                const Icon = isIphone ? Smartphone : isWifi ? Wifi : Network
                const hasIp = iface.addresses && iface.addresses.length > 0
                const ipv4 = iface.addresses?.find(
                  (a) => a.family === 4 || (a.family as unknown as string) === 'IPv4'
                )
                const ip = ipv4?.address || (hasIp ? iface.addresses[0].address : 'No IP address')
                const weight = metric?.weight ?? (hasIp ? 50 : 0)

                return (
                  <div
                    key={iface.id}
                    className="rounded-2xl border border-border/70 bg-card/70 p-5 shadow-xs space-y-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3.5">
                        <div
                          className={`flex h-11 w-11 items-center justify-center rounded-2xl shadow-xs ${
                            isIphone
                              ? 'bg-amber-500/15 text-amber-400'
                              : isWifi
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-cyan-500/15 text-cyan-400'
                          }`}
                        >
                          <Icon className="h-5.5 w-5.5" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="font-bold text-sm tracking-tight text-foreground">
                              {iface.displayName || iface.device}
                            </h3>
                            <span className="text-[10px] font-mono font-bold bg-muted px-2 py-0.5 rounded-md">
                              {iface.device}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground font-mono mt-0.5 block">
                            {ip}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          hasIp
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {hasIp ? 'Active' : 'Unassigned'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs pt-3 border-t border-border/40">
                      <div>
                        <span className="text-[10.5px] text-muted-foreground block">
                          Download Bandwidth
                        </span>
                        <span className="font-mono font-bold text-foreground tabular-nums text-sm">
                          {formatSpeed(metric?.downloadSpeedBytesPerSec || 0, speedUnit)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10.5px] text-muted-foreground block">
                          Upload Bandwidth
                        </span>
                        <span className="font-mono font-bold text-cyan-400 tabular-nums text-sm">
                          {formatSpeed(metric?.uploadSpeedBytesPerSec || 0, speedUnit)}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Multipath Weight</span>
                        <span className="font-mono font-bold text-foreground tabular-nums">
                          {weight}%
                        </span>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isIphone ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.max(4, weight)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 4: ⚙️ PREFERENCES & RULES (System Settings Panel)
            ========================================================================= */}
        {activeTab === 'settings' && (
          <div className="space-y-6 max-w-3xl">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Preferences & Rules
              </h2>
              <p className="text-xs text-muted-foreground">
                Configure network limits, storage destinations, proxy tunnels, and view preferences.
              </p>
            </div>

            <div className="rounded-2xl border border-border/70 bg-card/70 divide-y divide-border/40 shadow-xs">
              {/* Storage Destination */}
              <div className="p-4.5 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <FolderOpen className="h-4 w-4 text-emerald-400" />
                    <span className="text-xs font-bold text-foreground">Downloads Directory</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-mono truncate max-w-md">
                    {destinationDir}
                  </p>
                  {freeDisk !== null && (
                    <span className="text-[10px] text-muted-foreground block tabular-nums">
                      {formatBytes(freeDisk)} available on storage volume
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => void handlePickDirectory()}
                  className="rounded-xl border border-border/70 bg-card hover:bg-accent px-3 py-1.5 text-xs font-semibold active:scale-95 transition-all shadow-2xs"
                >
                  Change Folder...
                </button>
              </div>

              {/* Speed Unit Preference */}
              <div className="p-4.5 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-foreground">Speed Units</span>
                  <p className="text-[11px] text-muted-foreground">
                    Display speeds in megabytes per second (MB/s) or megabits per second (Mbps).
                  </p>
                </div>

                <div className="flex items-center rounded-xl bg-muted/60 p-0.5 border border-border/50 text-xs font-mono">
                  <button
                    type="button"
                    onClick={() => setSpeedUnit('bytes')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      speedUnit === 'bytes'
                        ? 'bg-card text-foreground font-bold shadow-xs'
                        : 'text-muted-foreground'
                    }`}
                  >
                    MB/s
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpeedUnit('bits')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      speedUnit === 'bits'
                        ? 'bg-card text-foreground font-bold shadow-xs'
                        : 'text-muted-foreground'
                    }`}
                  >
                    Mbps
                  </button>
                </div>
              </div>

              {/* Concurrent Downloads Limit */}
              <div className="p-4.5 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-foreground">Concurrent Transfers</span>
                  <p className="text-[11px] text-muted-foreground">
                    How many accelerated transfers run simultaneously; subsequent ones queue.
                  </p>
                </div>

                <select
                  value={downloadsAtOnce}
                  onChange={(e) => setDownloadsAtOnce(Number(e.target.value))}
                  className="rounded-xl border border-border/70 bg-card px-3 py-1.5 text-xs font-mono font-bold text-foreground outline-none"
                >
                  {[1, 2, 3, 5, 8, 10].map((num) => (
                    <option key={num} value={num}>
                      {num} at once
                    </option>
                  ))}
                </select>
              </div>

              {/* Slow Mode Toggle */}
              <div className="p-4.5 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-foreground">Slow Mode Bandwidth Cap</span>
                  <p className="text-[11px] text-muted-foreground">
                    Throttles aggregate bandwidth to keep connections free for conference calls.
                  </p>
                </div>

                <Switch checked={slowMode} onCheckedChange={setSlowMode} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Dialogs */}
      <LimitsDialog
        open={limitsOpen}
        onOpenChange={setLimitsOpen}
        showSchedule={showSchedule}
        page={limitsPage}
        onPageChange={setLimitsPage}
      />
    </div>
  )
}
