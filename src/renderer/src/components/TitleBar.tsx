import React, { useState } from 'react'
import { ArrowDownToLine, Network, Plus, RefreshCw, Sliders, Zap } from 'lucide-react'
import { TITLE_BAR_HEIGHT } from '../theme'
import { useAppStore } from '../store/useAppStore'
import { VelnqorLogo } from './VelnqorLogo'
import { formatBytes } from '../utils/format'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

const isMac = (window.velnqor || window.plexo).platform === 'darwin'

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
 * Redesigned Apple macOS Pro Unified Window Toolbar:
 * - Liquid Glass floating chrome with 1px light-catching edge
 * - Native window controls spacing (84px on macOS)
 * - Apple Segmented Navigation Switcher with spring tactility
 * - Tabular live multi-WAN aggregate throughput
 * - Fast action accelerators (New Turbo Download & Scan)
 */
export function TitleBar(): React.JSX.Element {
  const bondingActive = useAppStore((state) => state.bondingState.active)
  const totalDownloadSpeed = useAppStore((state) => state.bondingState.totalDownloadSpeed)
  const totalUploadSpeed = useAppStore((state) => state.bondingState.totalUploadSpeed)
  const speedUnit = useAppStore((state) => state.speedUnit)
  const openNewDownload = useAppStore((state) => state.openNewDownload)
  const loadInterfaces = useAppStore((state) => state.loadInterfaces)
  const interfacesStatus = useAppStore((state) => state.interfacesStatus)
  const activeTab = useAppStore((state) => state.activeTab)
  const setActiveTab = useAppStore((state) => state.setActiveTab)
  const downloads = useAppStore((state) => state.downloads)
  const interfaces = useAppStore((state) => state.interfaces)

  const [isScanning, setIsScanning] = useState(false)
  const hasTraffic = totalDownloadSpeed > 0 || totalUploadSpeed > 0

  const activeDownloadsCount = Object.values(downloads ?? {}).filter(
    (d) => d && (d.status === 'downloading' || d.status === 'queued')
  ).length

  const handleScan = async (): Promise<void> => {
    setIsScanning(true)
    try {
      await loadInterfaces()
    } finally {
      setIsScanning(false)
    }
  }

  return (
    <div
      style={{ height: TITLE_BAR_HEIGHT }}
      className={`relative flex shrink-0 items-center justify-between border-b border-black/[0.08] dark:border-white/[0.08] bg-[#fbfbfd]/80 dark:bg-[#1e1e1e]/80 backdrop-blur-xl select-none [-webkit-app-region:drag] ${
        isMac ? 'pl-[84px] pr-3.5' : 'px-3.5'
      }`}
    >
      {/* Brand Identity: Clean macOS App Identity */}
      <div className="flex items-center space-x-2 shrink-0">
        <div className="flex items-center justify-center">
          <VelnqorLogo className="h-4.5 w-4.5 rounded-md shadow-2xs" />
        </div>
        <div className="flex items-center space-x-2">
          <span className="font-sans text-[13px] font-semibold tracking-tight text-foreground">
            Velnqor
          </span>
          <span
            className={`hidden xl:inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide transition-all ${
              bondingActive
                ? 'bg-[#34c759]/15 text-[#248a3d] dark:text-[#34c759]'
                : 'bg-black/[0.04] dark:bg-white/[0.06] text-muted-foreground'
            }`}
          >
            <span
              className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
                bondingActive ? 'bg-[#34c759]' : 'bg-muted-foreground/60'
              }`}
            />
            {bondingActive ? 'Bonding Active' : 'Standby'}
          </span>
        </div>
      </div>

      {/* Center: Apple macOS Segmented Navigation Control */}
      <div className="flex items-center rounded-lg bg-black/[0.05] dark:bg-white/[0.08] p-0.5 border border-black/[0.04] dark:border-white/[0.06] text-[11.5px] font-medium [-webkit-app-region:no-drag] shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveTab('bonding')}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded-[6px] transition-all active:scale-[0.98] ${
            activeTab === 'bonding'
              ? 'bg-white dark:bg-[#323236] text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.12)] font-semibold'
              : 'text-muted-foreground hover:text-foreground hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
          }`}
        >
          <Zap className={`h-3 w-3 ${activeTab === 'bonding' ? 'text-[#007aff]' : ''}`} />
          <span>Multi-WAN Studio</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('downloads')}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded-[6px] transition-all active:scale-[0.98] ${
            activeTab === 'downloads'
              ? 'bg-white dark:bg-[#323236] text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.12)] font-semibold'
              : 'text-muted-foreground hover:text-foreground hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
          }`}
        >
          <ArrowDownToLine
            className={`h-3 w-3 ${activeTab === 'downloads' ? 'text-[#007aff]' : ''}`}
          />
          <span>Transfers</span>
          {activeDownloadsCount > 0 && (
            <span className="h-3.5 min-w-3.5 px-1 rounded-full bg-[#007aff] text-white text-[9.5px] font-semibold flex items-center justify-center tabular-nums">
              {activeDownloadsCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('networks')}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded-[6px] transition-all active:scale-[0.98] ${
            activeTab === 'networks'
              ? 'bg-white dark:bg-[#323236] text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.12)] font-semibold'
              : 'text-muted-foreground hover:text-foreground hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
          }`}
        >
          <Network className={`h-3 w-3 ${activeTab === 'networks' ? 'text-[#007aff]' : ''}`} />
          <span>Adapters</span>
          <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
            ({interfaces.length})
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded-[6px] transition-all active:scale-[0.98] ${
            activeTab === 'settings'
              ? 'bg-white dark:bg-[#323236] text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.12)] font-semibold'
              : 'text-muted-foreground hover:text-foreground hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
          }`}
        >
          <Sliders className={`h-3 w-3 ${activeTab === 'settings' ? 'text-[#007aff]' : ''}`} />
          <span>Settings</span>
        </button>
      </div>

      {/* Right: Live Speed Telemetry + Quick Actions */}
      <div className="flex items-center space-x-2 [-webkit-app-region:no-drag]">
        {hasTraffic && (
          <div className="hidden lg:flex items-center space-x-2 px-2.5 py-0.5 rounded-md bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.05] dark:border-white/[0.08] text-[11px] font-mono tabular-nums text-foreground shadow-2xs">
            <span className="text-foreground font-medium flex items-center space-x-1">
              <span className="text-[9.5px] text-[#34c759]">↓</span>
              <span>{formatCompactSpeed(totalDownloadSpeed, speedUnit)}</span>
            </span>
            <span className="text-muted-foreground/30">·</span>
            <span className="text-muted-foreground font-medium flex items-center space-x-1">
              <span className="text-[9.5px] text-[#5856d6]">↑</span>
              <span>{formatCompactSpeed(totalUploadSpeed, speedUnit)}</span>
            </span>
          </div>
        )}

        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={() => void handleScan()}
                disabled={isScanning || interfacesStatus === 'loading'}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.08] active:scale-[0.98] transition-all"
                aria-label="Scan Networks"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isScanning || interfacesStatus === 'loading' ? 'animate-spin text-[#007aff]' : ''}`}
                />
              </button>
            }
          />
          <TooltipContent>Scan Available Networks</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={() => openNewDownload()}
                className="flex h-7 items-center space-x-1.5 rounded-md bg-[#007aff] hover:bg-[#0071e3] text-white font-medium px-2.5 text-xs active:scale-[0.98] transition-all shadow-2xs"
                aria-label="New Download"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline text-[11.5px]">New Download</span>
              </button>
            }
          />
          <TooltipContent>Accelerate URL, Magnet, or File</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
