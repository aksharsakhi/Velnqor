import React, { useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Globe,
  Layers,
  Plus,
  Power,
  RefreshCw,
  Smartphone,
  Wifi,
  X,
  Zap
} from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { VelnqorLogo } from '../components/VelnqorLogo'
import { formatBytes } from '../utils/format'

function formatCompactSpeed(bytesPerSec: number, speedUnit: 'bytes' | 'bits'): string {
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
 * High-end macOS Menu Bar Companion Popover Window:
 * - Built according to Apple Human Interface Guidelines and Emil Kowalski interaction engineering
 * - Two-layer rule: functional Liquid Glass popover shell with crisp, high-contrast content cards
 * - Tabular numbers (tabular-nums font-mono) for zero digit jitter across all live metrics
 * - Tactile button feedback (active:scale-[0.975])
 * - Semantic hardware squircle icons (Wi-Fi: Emerald, iPhone USB: Amber, Ethernet: Cyan)
 * - Zero unnecessary subwindows: directly activates bonding, toggles Mac proxy, monitors adapters
 */
export function MiniTrayScreen(): React.JSX.Element {
  const {
    bondingState,
    toggleBonding,
    toggleSystemProxy,
    runSpeedTest,
    interfaces,
    speedUnit,
    downloads,
    openNewDownload
  } = useAppStore()

  const {
    active: bondingActive,
    systemProxyActive,
    totalDownloadSpeed,
    totalUploadSpeed,
    interfaces: interfaceMetrics,
    isSpeedTesting
  } = bondingState

  const [quickUrl, setQuickUrl] = useState('')
  const [isTogglingBond, setIsTogglingBond] = useState(false)
  const [isTogglingProxy, setIsTogglingProxy] = useState(false)

  const activeDownloadsList = Object.values(downloads).filter(
    (d) => d.status === 'downloading' || d.status === 'queued'
  )
  const activeDownload = activeDownloadsList[0]

  const handleToggleBonding = async (): Promise<void> => {
    setIsTogglingBond(true)
    try {
      await toggleBonding()
    } finally {
      setIsTogglingBond(false)
    }
  }

  const handleToggleProxy = async (): Promise<void> => {
    setIsTogglingProxy(true)
    try {
      await toggleSystemProxy(!systemProxyActive)
    } finally {
      setIsTogglingProxy(false)
    }
  }

  const handleOpenFullWindow = (): void => {
    window.velnqor?.openMainWindow?.()
  }

  const handleHideTray = (): void => {
    window.velnqor?.hideTrayWindow?.()
  }

  const handleQuit = (): void => {
    window.velnqor?.quitApp?.()
  }

  const handleQuickDownload = (e: React.FormEvent): void => {
    e.preventDefault()
    if (!quickUrl.trim()) return
    const url = quickUrl.trim()
    setQuickUrl('')
    handleOpenFullWindow()
    openNewDownload(url)
  }

  return (
    <div className="flex h-screen w-screen flex-col justify-between overflow-hidden bg-[#131418]/95 p-3.5 text-neutral-100 select-none backdrop-blur-2xl ring-1 ring-white/10">
      {/* Top Header: Brand + Status + Navigation Controls */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
        <div className="flex items-center space-x-2">
          <div className="relative flex items-center justify-center">
            <VelnqorLogo className="h-5 w-5 rounded-md shadow-xs ring-1 ring-emerald-500/30" />
            {bondingActive && (
              <span className="absolute -inset-0.5 rounded-md bg-emerald-500/25 blur-xs -z-10 animate-pulse" />
            )}
          </div>
          <span className="text-[13px] font-bold tracking-tight text-white">Velnqor</span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9.5px] font-semibold tracking-wide transition-all ${
              bondingActive
                ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
                : 'bg-white/10 text-neutral-400 border border-white/5'
            }`}
          >
            <span
              className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${
                bondingActive ? 'animate-pulse bg-emerald-400' : 'bg-neutral-400'
              }`}
            />
            {bondingActive ? 'Bonding Active' : 'Standby'}
          </span>
        </div>

        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={handleOpenFullWindow}
            title="Open Full Velnqor Dashboard"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 transition-all hover:bg-white/10 hover:text-white active:scale-95"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleHideTray}
            title="Close Popover"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 transition-all hover:bg-white/10 hover:text-white active:scale-95"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col justify-between space-y-2.5 py-2.5 overflow-y-auto">
        {/* Hero Bonding Control Card */}
        <div
          className={`rounded-2xl border p-3 shadow-md transition-all duration-200 ${
            bondingActive
              ? 'border-emerald-500/30 bg-gradient-to-b from-emerald-500/10 to-transparent'
              : 'border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02]'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors shadow-xs ${
                  bondingActive
                    ? 'bg-emerald-500/25 text-emerald-300 ring-1 ring-emerald-500/50'
                    : 'bg-white/10 text-neutral-300'
                }`}
              >
                <Zap className={`h-5 w-5 ${bondingActive ? 'fill-emerald-400/20' : ''}`} />
              </div>
              <div>
                <div className="text-[12.5px] font-semibold text-white tracking-tight">
                  {bondingActive ? 'Multi-Network Bonding' : 'Bonding Inactive'}
                </div>
                <div className="text-[10.5px] text-neutral-400">
                  {bondingActive
                    ? `${interfaces.length} network ${interfaces.length === 1 ? 'adapter' : 'adapters'} bonded`
                    : 'Combine Wi-Fi + Mobile + Ethernet'}
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={isTogglingBond}
              onClick={handleToggleBonding}
              className={`flex items-center space-x-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold shadow-xs transition-all active:scale-95 disabled:opacity-50 ${
                bondingActive
                  ? 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40 hover:bg-rose-500/30'
                  : 'bg-emerald-500 text-neutral-950 hover:bg-emerald-400 shadow-emerald-500/20'
              }`}
            >
              <Power className="h-3.5 w-3.5" />
              <span>{bondingActive ? 'Stop' : 'Activate'}</span>
            </button>
          </div>
        </div>

        {/* Live Throughput Metrics Card with Tabular Numbers */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 shadow-2xs">
            <div className="flex items-center space-x-1 text-[10.5px] font-semibold text-neutral-400 uppercase tracking-wider">
              <ArrowDown className="h-3.5 w-3.5 text-emerald-400" />
              <span>Download</span>
            </div>
            <div className="mt-1 font-mono text-[16px] font-black tracking-tight text-white tabular-nums">
              {formatCompactSpeed(totalDownloadSpeed, speedUnit)}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 shadow-2xs">
            <div className="flex items-center space-x-1 text-[10.5px] font-semibold text-neutral-400 uppercase tracking-wider">
              <ArrowUp className="h-3.5 w-3.5 text-cyan-400" />
              <span>Upload</span>
            </div>
            <div className="mt-1 font-mono text-[16px] font-black tracking-tight text-white tabular-nums">
              {formatCompactSpeed(totalUploadSpeed, speedUnit)}
            </div>
          </div>
        </div>

        {/* Route Mac Traffic (System Proxy) Toggle */}
        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 shadow-2xs">
          <div className="flex items-center space-x-2.5">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                systemProxyActive
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-white/5 text-neutral-400'
              }`}
            >
              <Globe className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[12px] font-semibold text-white tracking-tight">
                Route Mac Traffic
              </div>
              <div className="text-[10px] text-neutral-400">Accelerate all macOS apps</div>
            </div>
          </div>

          <button
            type="button"
            disabled={isTogglingProxy}
            onClick={handleToggleProxy}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
              systemProxyActive ? 'bg-emerald-500' : 'bg-neutral-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                systemProxyActive ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Connected Adapters Summary with Semantic Tints & Tabular Numbers */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 shadow-2xs">
          <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-300 mb-1.5">
            <span className="uppercase tracking-wider text-[10px] text-neutral-400">
              Connected Adapters ({interfaces.length})
            </span>
            <button
              type="button"
              onClick={() => runSpeedTest()}
              disabled={isSpeedTesting}
              className="flex items-center space-x-1 text-[10px] text-emerald-400 hover:text-emerald-300 disabled:opacity-50 active:scale-95 transition-all"
            >
              <RefreshCw className={`h-2.5 w-2.5 ${isSpeedTesting ? 'animate-spin' : ''}`} />
              <span>{isSpeedTesting ? 'Benchmarking...' : 'Benchmark'}</span>
            </button>
          </div>

          <div className="space-y-1.5">
            {interfaces.length === 0 ? (
              <div className="text-center text-[11px] text-neutral-400 py-1">
                No active network connections
              </div>
            ) : (
              interfaces.slice(0, 3).map((iface) => {
                const metric = interfaceMetrics[iface.id]
                const isWifi =
                  iface.kind === 'wifi' ||
                  iface.displayName?.toLowerCase().includes('wi-fi') ||
                  iface.device?.toLowerCase().includes('en0')
                const isMobile =
                  iface.kind === 'usb' ||
                  iface.displayName?.toLowerCase().includes('iphone') ||
                  iface.displayName?.toLowerCase().includes('usb')

                const hwSpeed =
                  (metric?.downloadSpeedBytesPerSec ?? 0) + (metric?.uploadSpeedBytesPerSec ?? 0)
                const isActive = hwSpeed > 0

                return (
                  <div
                    key={iface.id}
                    className="flex items-center justify-between rounded-xl bg-white/[0.02] border border-white/5 px-2.5 py-1.5 text-[11px]"
                  >
                    <div className="flex items-center space-x-2 truncate pr-2">
                      <div
                        className={`flex h-5.5 w-5.5 items-center justify-center rounded-md ${
                          isMobile
                            ? 'bg-amber-500/15 text-amber-400'
                            : isWifi
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-cyan-500/15 text-cyan-400'
                        }`}
                      >
                        {isWifi ? (
                          <Wifi className="h-3 w-3" />
                        ) : isMobile ? (
                          <Smartphone className="h-3 w-3" />
                        ) : (
                          <Layers className="h-3 w-3" />
                        )}
                      </div>
                      <span className="truncate text-neutral-200 font-medium">
                        {iface.displayName || iface.device}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1.5 shrink-0">
                      <span
                        className={`inline-flex items-center rounded-full px-1.5 py-0.2 text-[9px] font-semibold ${
                          isActive
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-white/10 text-neutral-400'
                        }`}
                      >
                        {isActive ? 'Active' : 'Ready'}
                      </span>
                      {hwSpeed > 0 && (
                        <span className="font-mono text-[10px] text-neutral-300 tabular-nums">
                          {formatCompactSpeed(hwSpeed, speedUnit)}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Active Transfer or Quick Accelerator Bar */}
        {activeDownload ? (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-2.5 shadow-2xs">
            <div className="flex items-center justify-between text-[11px]">
              <span className="truncate font-semibold text-emerald-300 pr-2">
                {activeDownload.fileName || activeDownload.url}
              </span>
              <span className="shrink-0 font-mono text-[10px] text-emerald-400 font-bold tabular-nums">
                {formatCompactSpeed(activeDownload.speedBytesPerSec ?? 0, speedUnit)}
              </span>
            </div>

            {/* Progress bar */}
            {activeDownload.totalBytes && activeDownload.totalBytes > 0 ? (
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        ((activeDownload.bytesDownloaded ?? 0) / activeDownload.totalBytes) * 100
                      )
                    )}%`
                  }}
                />
              </div>
            ) : null}
          </div>
        ) : (
          <form onSubmit={handleQuickDownload} className="relative">
            <input
              type="text"
              value={quickUrl}
              onChange={(e) => setQuickUrl(e.target.value)}
              placeholder="Accelerate download URL..."
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-1.5 pl-3 pr-8 text-[11px] text-white placeholder:text-neutral-500 focus:border-emerald-500/50 focus:outline-hidden font-mono"
            />
            <button
              type="submit"
              disabled={!quickUrl.trim()}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-neutral-400 transition-all hover:text-emerald-400 active:scale-95 disabled:opacity-30"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </form>
        )}
      </div>

      {/* Footer Navigation: Tactile buttons */}
      <div className="flex items-center justify-between border-t border-white/10 pt-2.5 text-[11px]">
        <button
          type="button"
          onClick={handleQuit}
          className="text-neutral-400 transition-all hover:text-rose-400 active:scale-95"
        >
          Quit Velnqor
        </button>

        <button
          type="button"
          onClick={handleOpenFullWindow}
          className="flex items-center space-x-1 font-semibold text-emerald-400 transition-all hover:text-emerald-300 active:scale-95"
        >
          <span>Open Full Dashboard</span>
          <ExternalLink className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}
