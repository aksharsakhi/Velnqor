import React, { useState } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
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

  const [isScanning, setIsScanning] = useState(false)
  const hasTraffic = totalDownloadSpeed > 0 || totalUploadSpeed > 0

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
            {activeTab === 'bonding'
              ? 'Multi-WAN Studio'
              : activeTab === 'downloads'
                ? 'Transfers'
                : activeTab === 'networks'
                  ? 'Network Adapters'
                  : 'Preferences'}
          </span>
        </div>
      </div>

      {/* Center: Live Speed Telemetry Capsule */}
      <div className="flex items-center [-webkit-app-region:no-drag]">
        <div className="flex items-center space-x-2 px-2.5 py-0.5 rounded-md bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.05] dark:border-white/[0.08] text-[11px] font-mono tabular-nums text-foreground shadow-2xs">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              bondingActive ? 'bg-[#34c759]' : 'bg-muted-foreground/60'
            }`}
          />
          <span className="text-foreground font-medium flex items-center space-x-1">
            <span className="text-[9.5px] text-[#34c759]">↓</span>
            <span>{formatCompactSpeed(totalDownloadSpeed, speedUnit)}</span>
          </span>
          <span className="text-muted-foreground/30">·</span>
          <span className="text-muted-foreground font-medium flex items-center space-x-1">
            <span className="text-[9.5px] text-[#0a84ff]">↑</span>
            <span>{formatCompactSpeed(totalUploadSpeed, speedUnit)}</span>
          </span>
        </div>
      </div>

      {/* Right: Actions */}
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
