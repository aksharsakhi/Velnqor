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
 * Compact, beautiful macOS menu bar companion popover window.
 * Provides basic operations at a glance:
 * - ⚡ Activate / Stop multi-network bonding
 * - 🌐 Route Mac traffic (system proxy) toggle
 * - Live bidirectional throughput (Download/Upload)
 * - Connected network adapters summary
 * - Active download progress or quick URL accelerator
 * - Quick jump to full Velnqor dashboard or quit
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
    <div className="flex h-screen w-screen flex-col justify-between overflow-hidden bg-[#141518]/95 p-3.5 text-neutral-100 select-none backdrop-blur-2xl">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
        <div className="flex items-center space-x-2">
          <VelnqorLogo className="h-5 w-5 rounded-md shadow-xs ring-1 ring-emerald-500/30" />
          <span className="text-[13.5px] font-bold tracking-tight text-white">Velnqor</span>
          <span
            className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${
              bondingActive
                ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
                : 'bg-white/10 text-neutral-400'
            }`}
          >
            <span
              className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${
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
            className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleHideTray}
            title="Close Popover"
            className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col justify-between space-y-2.5 py-2.5 overflow-y-auto">
        {/* Hero Bonding Control Button */}
        <div className="rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-3 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                  bondingActive
                    ? 'bg-emerald-500/25 text-emerald-300 ring-1 ring-emerald-500/50'
                    : 'bg-white/10 text-neutral-300'
                }`}
              >
                <Zap className={`h-5 w-5 ${bondingActive ? 'fill-emerald-400/20' : ''}`} />
              </div>
              <div>
                <div className="text-[13px] font-semibold text-white">
                  {bondingActive ? 'Multi-Network Bonding' : 'Bonding Inactive'}
                </div>
                <div className="text-[11px] text-neutral-400">
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
              className={`flex items-center space-x-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-xs transition-all ${
                bondingActive
                  ? 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40 hover:bg-rose-500/30'
                  : 'bg-emerald-500 text-neutral-950 hover:bg-emerald-400 active:scale-98'
              }`}
            >
              <Power className="h-3.5 w-3.5" />
              <span>{bondingActive ? 'Stop' : 'Activate'}</span>
            </button>
          </div>
        </div>

        {/* Live Throughput Metrics Card */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
            <div className="flex items-center space-x-1 text-[11px] font-medium text-neutral-400">
              <ArrowDown className="h-3.5 w-3.5 text-emerald-400" />
              <span>Download</span>
            </div>
            <div className="mt-1 font-mono text-[15px] font-bold text-white">
              {formatCompactSpeed(totalDownloadSpeed, speedUnit)}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
            <div className="flex items-center space-x-1 text-[11px] font-medium text-neutral-400">
              <ArrowUp className="h-3.5 w-3.5 text-cyan-400" />
              <span>Upload</span>
            </div>
            <div className="mt-1 font-mono text-[15px] font-bold text-white">
              {formatCompactSpeed(totalUploadSpeed, speedUnit)}
            </div>
          </div>
        </div>

        {/* Route Mac Traffic (System Proxy) Toggle */}
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
          <div className="flex items-center space-x-2">
            <Globe
              className={`h-4 w-4 ${systemProxyActive ? 'text-emerald-400' : 'text-neutral-400'}`}
            />
            <div>
              <div className="text-[12px] font-medium text-white">Route Mac Traffic</div>
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

        {/* Connected Adapters Summary */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-300 mb-1.5">
            <span>Connected Adapters ({interfaces.length})</span>
            <button
              type="button"
              onClick={() => runSpeedTest()}
              disabled={isSpeedTesting}
              className="flex items-center space-x-1 text-[10px] text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
            >
              <RefreshCw className={`h-2.5 w-2.5 ${isSpeedTesting ? 'animate-spin' : ''}`} />
              <span>{isSpeedTesting ? 'Testing...' : 'Test Speed'}</span>
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
                    className="flex items-center justify-between rounded-lg bg-white/[0.02] px-2 py-1 text-[11px]"
                  >
                    <div className="flex items-center space-x-1.5 truncate pr-2">
                      {isWifi ? (
                        <Wifi className="h-3 w-3 shrink-0 text-emerald-400" />
                      ) : isMobile ? (
                        <Smartphone className="h-3 w-3 shrink-0 text-amber-400" />
                      ) : (
                        <Layers className="h-3 w-3 shrink-0 text-cyan-400" />
                      )}
                      <span className="truncate text-neutral-200">
                        {iface.displayName || iface.device}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1.5 shrink-0">
                      <span
                        className={`inline-flex items-center rounded-full px-1.5 py-0.2 text-[9px] font-medium ${
                          isActive
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-white/10 text-neutral-400'
                        }`}
                      >
                        {isActive ? 'Active' : 'Ready'}
                      </span>
                      {hwSpeed > 0 && (
                        <span className="font-mono text-[10px] text-neutral-300">
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

        {/* Active Transfer or Quick Accelerator */}
        {activeDownload ? (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-2.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="truncate font-medium text-emerald-300 pr-2">
                {activeDownload.fileName || activeDownload.url}
              </span>
              <span className="shrink-0 font-mono text-[10px] text-emerald-400">
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
              placeholder="Quick accelerate download URL..."
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-1.5 pl-3 pr-8 text-[11px] text-white placeholder:text-neutral-500 focus:border-emerald-500/50 focus:outline-hidden"
            />
            <button
              type="submit"
              disabled={!quickUrl.trim()}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-neutral-400 transition-colors hover:text-emerald-400 disabled:opacity-30"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </form>
        )}
      </div>

      {/* Footer Navigation */}
      <div className="flex items-center justify-between border-t border-white/10 pt-2.5 text-[11px]">
        <button
          type="button"
          onClick={handleQuit}
          className="text-neutral-400 transition-colors hover:text-rose-400"
        >
          Quit Velnqor
        </button>

        <button
          type="button"
          onClick={handleOpenFullWindow}
          className="flex items-center space-x-1 font-semibold text-emerald-400 transition-colors hover:text-emerald-300"
        >
          <span>Open Full Dashboard</span>
          <ExternalLink className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}
