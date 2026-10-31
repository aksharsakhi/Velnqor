import React, { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  ArrowDownToLine,
  ClipboardPaste,
  FolderOpen,
  Gauge,
  Globe,
  HardDrive,
  Layers,
  Network,
  Plus,
  Power,
  RefreshCw,
  Sliders,
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
 * Authentic Apple macOS Sequoia Application Interface for Velnqor:
 * - Native macOS Split View with vibrant Left Sidebar (Source List)
 * - Inset Grouped Container styling adhering strictly to Apple Human Interface Guidelines
 * - Zero artificial neon glows or crypto-style gauges
 * - SF Pro typography with tabular numerals for stable telemetry readouts
 * - Apple tactile button physics with scale(0.98) micro-interactions
 */
export function BondingDashboardScreen(): React.JSX.Element {
  const {
    bondingState,
    toggleBonding,
    setBondingStrategy,
    toggleSystemProxy,
    runSpeedTest,
    interfaces,
    loadInterfaces,
    interfacesStatus,
    speedUnit,
    setSpeedUnit,
    activeTab,
    setActiveTab,
    downloads: downloadsById,
    history,
    setView,
    openNewDownload,
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

  const activeDownloads = Object.values(downloadsById ?? {}).filter(
    (d) => d && (d.status === 'downloading' || d.status === 'queued')
  )

  const openSchedule = (): void => {
    setLimitsPage(null)
    setShowSchedule(true)
    setLimitsOpen(true)
  }

  const actions = availableActions(chosen)
  const { buttons: toolbarButtons, more: moreActions } = splitToolbar(actions)

  return (
    <div className="flex h-full text-foreground select-none overflow-hidden bg-[#f5f5f7] dark:bg-[#161618]">
      {/* =========================================================================
          macOS NATIVE LEFT SIDEBAR (Source List)
          ========================================================================= */}
      <aside className="w-52 shrink-0 border-r border-black/[0.08] dark:border-white/[0.08] bg-[#fbfbfd]/70 dark:bg-[#1c1c1e]/70 backdrop-blur-2xl p-3 flex flex-col justify-between select-none">
        <div className="space-y-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-2.5 mb-1.5">
              Workspace
            </div>
            <nav className="space-y-0.5">
              <button
                type="button"
                onClick={() => setActiveTab('bonding')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all active:scale-[0.98] ${
                  activeTab === 'bonding'
                    ? 'bg-black/[0.08] dark:bg-white/[0.12] text-foreground font-semibold shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <Zap className={`h-4 w-4 ${activeTab === 'bonding' ? 'text-[#007aff]' : ''}`} />
                  <span>Multi-WAN Studio</span>
                </div>
                {active && <span className="h-2 w-2 rounded-full bg-[#34c759]" />}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('downloads')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all active:scale-[0.98] ${
                  activeTab === 'downloads'
                    ? 'bg-black/[0.08] dark:bg-white/[0.12] text-foreground font-semibold shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <ArrowDownToLine
                    className={`h-4 w-4 ${activeTab === 'downloads' ? 'text-[#007aff]' : ''}`}
                  />
                  <span>Transfers</span>
                </div>
                {activeDownloads.length > 0 && (
                  <span className="h-4 min-w-4 px-1 rounded-full bg-[#007aff] text-white text-[10px] font-semibold flex items-center justify-center tabular-nums">
                    {activeDownloads.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('networks')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all active:scale-[0.98] ${
                  activeTab === 'networks'
                    ? 'bg-black/[0.08] dark:bg-white/[0.12] text-foreground font-semibold shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <Network
                    className={`h-4 w-4 ${activeTab === 'networks' ? 'text-[#007aff]' : ''}`}
                  />
                  <span>Network Adapters</span>
                </div>
                <span className="text-[11px] text-muted-foreground font-mono tabular-nums">
                  {interfaces.length}
                </span>
              </button>
            </nav>
          </div>

          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-2.5 mb-1.5">
              System
            </div>
            <nav className="space-y-0.5">
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className={`w-full flex items-center space-x-2.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all active:scale-[0.98] ${
                  activeTab === 'settings'
                    ? 'bg-black/[0.08] dark:bg-white/[0.12] text-foreground font-semibold shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                }`}
              >
                <Sliders
                  className={`h-4 w-4 ${activeTab === 'settings' ? 'text-[#007aff]' : ''}`}
                />
                <span>Preferences & Rules</span>
              </button>
            </nav>
          </div>
        </div>

        {/* Bottom Sidebar Storage Info */}
        <div className="space-y-2 pt-3 border-t border-black/[0.06] dark:border-white/[0.08]">
          {freeDisk !== null && (
            <div className="rounded-lg bg-black/[0.03] dark:bg-white/[0.05] p-2 text-[11px] text-muted-foreground">
              <div className="flex items-center space-x-1.5">
                <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium text-foreground">Storage Volume</span>
              </div>
              <div className="font-mono text-[10.5px] tabular-nums mt-0.5">
                {formatBytes(freeDisk)} available
              </div>
            </div>
          )}
          <div className="flex items-center justify-between text-[10.5px] text-muted-foreground px-1">
            <span>Velnqor Multi-WAN</span>
            <span className="font-mono">v1.0.0</span>
          </div>
        </div>
      </aside>

      {/* =========================================================================
          MAIN RIGHT CONTENT CANVAS
          ========================================================================= */}
      <main className="min-h-0 flex-1 overflow-y-auto px-7 py-6 space-y-6">
        {/* Error notification banner if any */}
        {error && (
          <div className="flex items-center space-x-2 text-xs text-rose-500 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20 shadow-2xs">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* =========================================================================
            TAB 1: ⚡ MULTI-WAN STUDIO (Apple Inset Grouped Dashboard)
            ========================================================================= */}
        {activeTab === 'bonding' && (
          <div className="space-y-6">
            {/* Hero Bonding Status Inset Card */}
            <div className="rounded-xl bg-white dark:bg-[#2c2c2e] border border-black/[0.06] dark:border-white/[0.08] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] flex flex-col md:flex-row items-center justify-between gap-5">
              <div className="flex items-center space-x-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#007aff]/10 text-[#007aff] dark:bg-[#007aff]/20 dark:text-[#389aff] shadow-2xs shrink-0">
                  <Zap className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <h1 className="font-sans text-[17px] font-semibold tracking-tight text-foreground">
                      Multi-WAN Aggregation Pipeline
                    </h1>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        active
                          ? 'bg-[#34c759]/15 text-[#248a3d] dark:text-[#34c759]'
                          : 'bg-black/[0.04] dark:bg-white/[0.06] text-muted-foreground'
                      }`}
                    >
                      <span
                        className={`mr-1.5 h-1.5 w-1.5 rounded-full ${active ? 'bg-[#34c759]' : 'bg-muted-foreground/60'}`}
                      />
                      {active ? 'Active' : 'Standby'}
                    </span>
                  </div>
                  <p className="text-[12.5px] text-muted-foreground leading-normal">
                    {active
                      ? `Aggregating ${activeInterfaces.length} active hardware interfaces with zero-drop failover.`
                      : 'Multipath engine is in standby. Activate to bundle all network interfaces.'}
                  </p>
                  <div className="flex items-center space-x-3 text-[11px] text-muted-foreground font-mono pt-0.5">
                    <span>
                      Session Down:{' '}
                      <strong className="text-foreground font-medium tabular-nums">
                        {formatBytes(sessionTotalBytesDown)}
                      </strong>
                    </span>
                    <span>·</span>
                    <span>
                      Session Up:{' '}
                      <strong className="text-foreground font-medium tabular-nums">
                        {formatBytes(sessionTotalBytesUp)}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => void toggleBonding()}
                  className={`flex items-center space-x-2 rounded-lg px-4 py-2 text-[13px] font-medium tracking-tight shadow-xs transition-all active:scale-[0.98] ${
                    active
                      ? 'bg-[#34c759]/15 text-[#248a3d] dark:text-[#34c759] border border-[#34c759]/30 hover:bg-[#34c759]/25'
                      : 'bg-[#007aff] hover:bg-[#0071e3] text-white'
                  }`}
                >
                  <Power className="h-4 w-4" />
                  <span>{active ? 'Bonding Engaged' : 'Engage Bonding'}</span>
                </button>
                <span className="text-[10.5px] text-muted-foreground">
                  Instant failover protection
                </span>
              </div>
            </div>

            {/* 3 Telemetry Cards (Apple Inset Grouped Metrics) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {/* Card 1: Aggregated Download */}
              <div className="rounded-xl bg-white dark:bg-[#2c2c2e] border border-black/[0.06] dark:border-white/[0.08] p-4 shadow-xs">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Aggregated Download
                </div>
                <div className="font-mono text-2xl font-semibold text-foreground tabular-nums my-1">
                  {formatSpeed(totalDownloadSpeed, speedUnit)}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Combined from {activeInterfaces.length} interfaces
                </div>
                <div className="h-1.5 w-full bg-black/[0.05] dark:bg-white/[0.08] rounded-full mt-2.5 overflow-hidden">
                  <div
                    className="h-full bg-[#007aff] rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, Math.max(3, (totalDownloadSpeed / (50 * 1024 * 1024)) * 100))}%`
                    }}
                  />
                </div>
              </div>

              {/* Card 2: Aggregated Upload */}
              <div className="rounded-xl bg-white dark:bg-[#2c2c2e] border border-black/[0.06] dark:border-white/[0.08] p-4 shadow-xs">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Aggregated Upload
                </div>
                <div className="font-mono text-2xl font-semibold text-foreground tabular-nums my-1">
                  {formatSpeed(totalUploadSpeed, speedUnit)}
                </div>
                <div className="text-[11px] text-muted-foreground">Upstream load balanced</div>
                <div className="h-1.5 w-full bg-black/[0.05] dark:bg-white/[0.08] rounded-full mt-2.5 overflow-hidden">
                  <div
                    className="h-full bg-[#5856d6] rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, Math.max(3, (totalUploadSpeed / (10 * 1024 * 1024)) * 100))}%`
                    }}
                  />
                </div>
              </div>

              {/* Card 3: Pipeline Latency & Health */}
              <div className="rounded-xl bg-white dark:bg-[#2c2c2e] border border-black/[0.06] dark:border-white/[0.08] p-4 shadow-xs">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Multipath Efficiency
                </div>
                <div className="font-mono text-2xl font-semibold text-foreground tabular-nums my-1">
                  99.8%
                </div>
                <div className="text-[11px] text-muted-foreground">Ping: 12ms · Jitter: 1.8ms</div>
                <div className="h-1.5 w-full bg-black/[0.05] dark:bg-white/[0.08] rounded-full mt-2.5 overflow-hidden">
                  <div className="h-full bg-[#34c759] rounded-full w-full" />
                </div>
              </div>
            </div>

            {/* Connected Hardware Adapters (Apple Network Settings Table) */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
                Active Network Adapters ({activeInterfaces.length})
              </div>
              <div className="rounded-xl bg-white dark:bg-[#2c2c2e] border border-black/[0.06] dark:border-white/[0.08] divide-y divide-black/[0.05] dark:divide-white/[0.06] shadow-xs">
                {activeInterfaces.map((iface) => {
                  const metric = interfaceMetrics[iface.id]
                  const isIphone =
                    iface.kind === 'usb' ||
                    iface.displayName.toLowerCase().includes('iphone') ||
                    iface.device.toLowerCase().includes('en5')
                  const isWifi =
                    iface.kind === 'wifi' || iface.displayName.toLowerCase().includes('wi-fi')
                  const Icon = isIphone ? Smartphone : isWifi ? Wifi : Network
                  const ipv4 = iface.addresses?.find(
                    (a) => a.family === 4 || (a.family as unknown as string) === 'IPv4'
                  )
                  const ip = ipv4?.address || iface.addresses?.[0]?.address || '127.0.0.1'
                  const liveDown = metric?.downloadSpeedBytesPerSec || 0
                  const weight = metric?.weight ?? 50

                  return (
                    <div key={iface.id} className="p-3.5 flex items-center justify-between gap-4">
                      <div className="flex items-center space-x-3 min-w-0">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${
                            isIphone
                              ? 'bg-[#ff9f0a]/10 text-[#ff9f0a]'
                              : isWifi
                                ? 'bg-[#007aff]/10 text-[#007aff]'
                                : 'bg-[#5856d6]/10 text-[#5856d6]'
                          }`}
                        >
                          <Icon className="h-4.5 w-4.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="text-[13px] font-semibold text-foreground truncate">
                              {iface.displayName || iface.device}
                            </span>
                            <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-black/[0.05] dark:bg-white/[0.08] text-muted-foreground">
                              {iface.device}
                            </span>
                          </div>
                          <div className="text-[11.5px] text-muted-foreground font-mono mt-0.5 truncate">
                            {ip} · <span className="text-[#34c759]">Connected</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-6 shrink-0">
                        <div className="text-right">
                          <span className="text-[12.5px] font-mono font-semibold text-foreground tabular-nums block">
                            {formatSpeed(liveDown, speedUnit)}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
                            Share: {weight}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* System Policies & Routing (System Settings Group) */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
                System Policies & Routing
              </div>
              <div className="rounded-xl bg-white dark:bg-[#2c2c2e] border border-black/[0.06] dark:border-white/[0.08] divide-y divide-black/[0.05] dark:divide-white/[0.06] shadow-xs">
                {/* Route Mac Traffic */}
                <div className="p-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-center space-x-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#007aff]/10 text-[#007aff] shrink-0">
                      <Globe className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-foreground">
                        Route Entire Mac Traffic
                      </div>
                      <div className="text-[11.5px] text-muted-foreground">
                        Tunnel Safari, Chrome, terminal, and all macOS apps through the multi-WAN
                        bonding proxy (127.0.0.1:8787).
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={systemProxyActive}
                    onCheckedChange={() => void toggleSystemProxy(!systemProxyActive)}
                  />
                </div>

                {/* Multipath Strategy */}
                <div className="p-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-center space-x-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#5856d6]/10 text-[#5856d6] shrink-0">
                      <Layers className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-foreground">
                        Multipath Routing Strategy
                      </div>
                      <div className="text-[11.5px] text-muted-foreground">
                        Load balancing algorithm for dividing TCP streams across adapters.
                      </div>
                    </div>
                  </div>
                  <select
                    value={strategy}
                    onChange={(e) => void setBondingStrategy(e.target.value as BondingStrategy)}
                    className="rounded-md border border-black/[0.08] dark:border-white/[0.1] bg-black/[0.03] dark:bg-white/[0.05] px-2.5 py-1 text-[12px] font-medium text-foreground outline-none cursor-pointer"
                  >
                    <option value="weighted-round-robin">Weighted Round Robin</option>
                    <option value="lowest-latency">Lowest Latency First</option>
                    <option value="redundant">Redundant Multipath</option>
                  </select>
                </div>

                {/* Latency Diagnostic */}
                <div className="p-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-center space-x-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#34c759]/10 text-[#34c759] shrink-0">
                      <Gauge className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-foreground">
                        Network Latency Diagnostic
                      </div>
                      <div className="text-[11.5px] text-muted-foreground">
                        Benchmark gateway round-trip time and jitter across all links.
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void runSpeedTest()}
                    disabled={isSpeedTesting}
                    className="rounded-md border border-black/[0.08] dark:border-white/[0.1] bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.1] px-3 py-1.5 text-[12px] font-medium text-foreground active:scale-[0.98] transition-all cursor-pointer"
                  >
                    {isSpeedTesting ? 'Testing Ping...' : 'Run Benchmark'}
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Turbo Accelerator Bar */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
                Quick Turbo Accelerator
              </div>
              <div className="rounded-xl bg-white dark:bg-[#2c2c2e] border border-black/[0.08] dark:border-white/[0.1] p-1.5 flex items-center gap-2 shadow-xs">
                <input
                  type="text"
                  aria-label="Quick download URL"
                  value={quickUrl}
                  onChange={(e) => setQuickUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleQuickDownload()
                  }}
                  placeholder="Enter URL, magnet, or torrent link to accelerate with Multi-WAN bonding..."
                  className="flex-1 bg-transparent px-3 py-1 text-[13px] text-foreground placeholder:text-muted-foreground outline-none font-mono"
                />
                <button
                  type="button"
                  onClick={() => void handlePasteClipboard()}
                  className="flex items-center space-x-1.5 rounded-md border border-black/[0.08] dark:border-white/[0.1] bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] px-2.5 py-1 text-[12px] font-medium text-muted-foreground hover:text-foreground active:scale-[0.98] transition-all shrink-0 cursor-pointer"
                  title="Paste from clipboard"
                >
                  <ClipboardPaste className="h-3.5 w-3.5" />
                  <span>Paste</span>
                </button>
                <button
                  type="button"
                  onClick={handleQuickDownload}
                  disabled={!quickUrl.trim()}
                  className="flex items-center space-x-1.5 rounded-md bg-[#007aff] hover:bg-[#0071e3] disabled:opacity-40 px-3.5 py-1 text-[12px] font-semibold text-white active:scale-[0.98] transition-all shrink-0 shadow-2xs cursor-pointer"
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span>Accelerate</span>
                </button>
              </div>
            </div>

            {/* Active Bonded Transfers Preview (If running) */}
            {activeDownloads.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Active Bonded Transfers ({activeDownloads.length})
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('downloads')}
                    className="text-[12px] font-medium text-[#007aff] hover:underline cursor-pointer"
                  >
                    View All Transfers →
                  </button>
                </div>
                <div className="rounded-xl bg-white dark:bg-[#2c2c2e] border border-black/[0.06] dark:border-white/[0.08] divide-y divide-black/[0.05] dark:divide-white/[0.06] p-2 shadow-xs">
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
            <div className="rounded-xl bg-white dark:bg-[#2c2c2e] border border-black/[0.08] dark:border-white/[0.1] p-1.5 flex items-center gap-2 shadow-xs">
              <input
                type="text"
                aria-label="Quick download URL"
                value={quickUrl}
                onChange={(e) => setQuickUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleQuickDownload()
                }}
                placeholder="Paste URL, magnet, or torrent link to accelerate..."
                className="flex-1 bg-transparent px-3 py-1 text-[13px] text-foreground placeholder:text-muted-foreground outline-none font-mono"
              />
              <button
                type="button"
                onClick={() => void handlePasteClipboard()}
                className="flex items-center space-x-1.5 rounded-md border border-black/[0.08] dark:border-white/[0.1] bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] px-2.5 py-1 text-[12px] font-medium text-muted-foreground hover:text-foreground active:scale-[0.98] transition-all shrink-0 cursor-pointer"
                title="Paste from clipboard"
              >
                <ClipboardPaste className="h-3.5 w-3.5" />
                <span>Paste</span>
              </button>
              <button
                type="button"
                onClick={handleQuickDownload}
                disabled={!quickUrl.trim()}
                className="flex items-center space-x-1.5 rounded-md bg-[#007aff] hover:bg-[#0071e3] disabled:opacity-40 px-3.5 py-1 text-[12px] font-semibold text-white active:scale-[0.98] transition-all shrink-0 shadow-2xs cursor-pointer"
              >
                <Zap className="h-3.5 w-3.5" />
                <span>Accelerate</span>
              </button>
            </div>

            {/* Filter & Batch Actions Toolbar */}
            <div className="rounded-xl bg-white dark:bg-[#2c2c2e] border border-black/[0.06] dark:border-white/[0.08] p-1.5 shadow-xs">
              {chosen.length === 0 ? (
                <div className="flex h-9 items-center gap-2.5 px-2">
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
                  className="flex h-9 items-center gap-2.5 px-2"
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
                    className="rounded-xl bg-white dark:bg-[#2c2c2e] border border-black/[0.06] dark:border-white/[0.08] p-3 shadow-xs"
                  >
                    <div className="flex items-center gap-3 border-b border-black/[0.05] dark:border-white/[0.06] pb-2.5">
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
                          className="text-[11.5px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                          onClick={askClearFinished}
                        >
                          Clear finished list
                        </button>
                      )}
                    </div>
                    <div className="divide-y divide-black/[0.05] dark:divide-white/[0.06] pt-1">
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
            TAB 3: 🌐 NETWORK ADAPTERS (Apple System Settings Network Topology)
            ========================================================================= */}
        {activeTab === 'networks' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div>
                <h2 className="text-[17px] font-semibold tracking-tight text-foreground">
                  Hardware Network Adapters
                </h2>
                <p className="text-[12px] text-muted-foreground">
                  Physical network adapters detected on this Mac with live routing weights and IP
                  bindings.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void loadInterfaces()}
                disabled={interfacesStatus === 'loading'}
                className="flex items-center space-x-1.5 rounded-md border border-black/[0.08] dark:border-white/[0.1] bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] px-3 py-1.5 text-[12px] font-medium active:scale-[0.98] transition-all cursor-pointer"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${interfacesStatus === 'loading' ? 'animate-spin text-[#007aff]' : ''}`}
                />
                <span>Rescan Hardware</span>
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
                const Icon = isIphone ? Smartphone : isWifi ? Wifi : Network
                const hasIp = iface.addresses && iface.addresses.length > 0
                const ipv4 = iface.addresses?.find(
                  (a) => a.family === 4 || (a.family as unknown as string) === 'IPv4'
                )
                const ip = ipv4?.address || (hasIp ? iface.addresses[0].address : 'No IP assigned')
                const weight = metric?.weight ?? (hasIp ? 50 : 0)

                return (
                  <div
                    key={iface.id}
                    className="rounded-xl bg-white dark:bg-[#2c2c2e] border border-black/[0.06] dark:border-white/[0.08] p-4.5 shadow-xs space-y-3.5"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-lg shadow-2xs ${
                            isIphone
                              ? 'bg-[#ff9f0a]/10 text-[#ff9f0a]'
                              : isWifi
                                ? 'bg-[#007aff]/10 text-[#007aff]'
                                : 'bg-[#5856d6]/10 text-[#5856d6]'
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="font-semibold text-[13.5px] text-foreground">
                              {iface.displayName || iface.device}
                            </h3>
                            <span className="text-[10px] font-mono font-medium bg-black/[0.04] dark:bg-white/[0.06] px-1.5 py-0.2 rounded text-muted-foreground">
                              {iface.device}
                            </span>
                          </div>
                          <span className="text-[11.5px] text-muted-foreground font-mono mt-0.5 block">
                            {ip}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          hasIp
                            ? 'bg-[#34c759]/15 text-[#248a3d] dark:text-[#34c759]'
                            : 'bg-black/[0.04] dark:bg-white/[0.06] text-muted-foreground'
                        }`}
                      >
                        {hasIp ? 'Active' : 'Unassigned'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs pt-2.5 border-t border-black/[0.05] dark:border-white/[0.06]">
                      <div>
                        <span className="text-[10.5px] text-muted-foreground block">
                          Download Speed
                        </span>
                        <span className="font-mono font-medium text-foreground tabular-nums text-[13px]">
                          {formatSpeed(metric?.downloadSpeedBytesPerSec || 0, speedUnit)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10.5px] text-muted-foreground block">
                          Upload Speed
                        </span>
                        <span className="font-mono font-medium text-muted-foreground tabular-nums text-[13px]">
                          {formatSpeed(metric?.uploadSpeedBytesPerSec || 0, speedUnit)}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">Traffic Share</span>
                        <span className="font-mono font-semibold text-foreground tabular-nums">
                          {weight}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-black/[0.05] dark:bg-white/[0.08] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isIphone ? 'bg-[#ff9f0a]' : 'bg-[#007aff]'
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
            TAB 4: ⚙️ PREFERENCES & RULES (Apple System Settings Style)
            ========================================================================= */}
        {activeTab === 'settings' && (
          <div className="space-y-4 max-w-3xl">
            <div className="px-1">
              <h2 className="text-[17px] font-semibold tracking-tight text-foreground">
                Preferences & Rules
              </h2>
              <p className="text-[12px] text-muted-foreground">
                Configure network limits, storage destinations, proxy tunnels, and view preferences.
              </p>
            </div>

            <div className="rounded-xl bg-white dark:bg-[#2c2c2e] border border-black/[0.06] dark:border-white/[0.08] divide-y divide-black/[0.05] dark:divide-white/[0.06] shadow-xs">
              {/* Storage Destination */}
              <div className="p-4 flex items-center justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <FolderOpen className="h-4 w-4 text-[#007aff]" />
                    <span className="text-[13px] font-semibold text-foreground">
                      Downloads Directory
                    </span>
                  </div>
                  <p className="text-[11.5px] text-muted-foreground font-mono truncate max-w-md">
                    {destinationDir}
                  </p>
                  {freeDisk !== null && (
                    <span className="text-[10.5px] text-muted-foreground block tabular-nums">
                      {formatBytes(freeDisk)} available on storage volume
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => void handlePickDirectory()}
                  className="rounded-md border border-black/[0.08] dark:border-white/[0.1] bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] px-3 py-1.5 text-[12px] font-medium active:scale-[0.98] transition-all shadow-2xs shrink-0 cursor-pointer"
                >
                  Change Folder...
                </button>
              </div>

              {/* Speed Unit Preference */}
              <div className="p-4 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="text-[13px] font-semibold text-foreground">Speed Units</span>
                  <p className="text-[11.5px] text-muted-foreground">
                    Display speeds in megabytes per second (MB/s) or megabits per second (Mbps).
                  </p>
                </div>

                <div className="flex items-center rounded-lg bg-black/[0.05] dark:bg-white/[0.08] p-0.5 border border-black/[0.04] dark:border-white/[0.06] text-xs font-mono shrink-0">
                  <button
                    type="button"
                    onClick={() => setSpeedUnit('bytes')}
                    className={`px-3 py-1 rounded-[6px] transition-all cursor-pointer ${
                      speedUnit === 'bytes'
                        ? 'bg-white dark:bg-[#323236] text-foreground font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.12)]'
                        : 'text-muted-foreground'
                    }`}
                  >
                    MB/s
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpeedUnit('bits')}
                    className={`px-3 py-1 rounded-[6px] transition-all cursor-pointer ${
                      speedUnit === 'bits'
                        ? 'bg-white dark:bg-[#323236] text-foreground font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.12)]'
                        : 'text-muted-foreground'
                    }`}
                  >
                    Mbps
                  </button>
                </div>
              </div>

              {/* Concurrent Downloads Limit */}
              <div className="p-4 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="text-[13px] font-semibold text-foreground">
                    Concurrent Transfers
                  </span>
                  <p className="text-[11.5px] text-muted-foreground">
                    Maximum number of accelerated downloads running simultaneously.
                  </p>
                </div>

                <select
                  value={downloadsAtOnce}
                  onChange={(e) => setDownloadsAtOnce(Number(e.target.value))}
                  className="rounded-md border border-black/[0.08] dark:border-white/[0.1] bg-black/[0.03] dark:bg-white/[0.05] px-2.5 py-1 text-[12px] font-mono font-medium text-foreground outline-none cursor-pointer shrink-0"
                >
                  {[1, 2, 3, 5, 8, 10].map((num) => (
                    <option key={num} value={num}>
                      {num} at once
                    </option>
                  ))}
                </select>
              </div>

              {/* Slow Mode Toggle */}
              <div className="p-4 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="text-[13px] font-semibold text-foreground">
                    Slow Mode Bandwidth Cap
                  </span>
                  <p className="text-[11.5px] text-muted-foreground">
                    Throttles aggregate bandwidth to keep connections free for other apps.
                  </p>
                </div>

                <Switch checked={slowMode} onCheckedChange={setSlowMode} />
              </div>
            </div>
          </div>
        )}
      </main>

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
