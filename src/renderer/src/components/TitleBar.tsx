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
      className={`relative flex shrink-0 items-center justify-between border-b border-border/70 bg-card/85 backdrop-blur-2xl select-none [-webkit-app-region:drag] ${
        isMac ? 'pl-[84px] pr-3.5' : 'px-3.5'
      }`}
    >
      {/* Brand Identity: SVG Logo with Active Aura */}
      <div className="flex items-center space-x-2.5 shrink-0">
        <div className="relative flex items-center justify-center">
          <VelnqorLogo className="h-5 w-5 rounded-lg shadow-xs ring-1 ring-emerald-500/30" />
          {bondingActive && (
            <span className="absolute -inset-1 rounded-lg bg-emerald-500/25 blur-xs -z-10 animate-pulse" />
          )}
        </div>
        <div className="flex items-center space-x-2">
          <span className="font-sans text-[13px] font-bold tracking-tight text-foreground">
            Velnqor
          </span>
          <span
            className={`hidden xl:inline-flex items-center rounded-full px-2 py-0.5 text-[9.5px] font-semibold tracking-wide transition-all ${
              bondingActive
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/35 ring-1 ring-emerald-500/20'
                : 'bg-muted/70 text-muted-foreground border border-border/60'
            }`}
          >
            <span
              className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
                bondingActive ? 'bg-emerald-400 animate-pulse' : 'bg-muted-foreground/60'
              }`}
            />
            {bondingActive ? 'Bonding Active' : 'Standby'}
          </span>
        </div>
      </div>

      {/* Center: Apple macOS Segmented Navigation Control */}
      <div className="flex items-center rounded-xl bg-muted/60 p-0.5 border border-border/50 text-[11px] font-medium [-webkit-app-region:no-drag] shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveTab('bonding')}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg transition-all active:scale-95 ${
            activeTab === 'bonding'
              ? 'bg-card text-foreground shadow-xs font-bold border border-border/60'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Zap className={`h-3 w-3 ${activeTab === 'bonding' ? 'text-emerald-400' : ''}`} />
          <span>Multi-WAN Studio</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('downloads')}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg transition-all active:scale-95 ${
            activeTab === 'downloads'
              ? 'bg-card text-foreground shadow-xs font-bold border border-border/60'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <ArrowDownToLine
            className={`h-3 w-3 ${activeTab === 'downloads' ? 'text-emerald-400' : ''}`}
          />
          <span>Transfers</span>
          {activeDownloadsCount > 0 && (
            <span className="h-4 min-w-4 px-1 rounded-full bg-emerald-500 text-neutral-950 text-[9.5px] font-black flex items-center justify-center tabular-nums">
              {activeDownloadsCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('networks')}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg transition-all active:scale-95 ${
            activeTab === 'networks'
              ? 'bg-card text-foreground shadow-xs font-bold border border-border/60'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Network className={`h-3 w-3 ${activeTab === 'networks' ? 'text-emerald-400' : ''}`} />
          <span>Adapters</span>
          <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
            ({interfaces.length})
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg transition-all active:scale-95 ${
            activeTab === 'settings'
              ? 'bg-card text-foreground shadow-xs font-bold border border-border/60'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sliders className={`h-3 w-3 ${activeTab === 'settings' ? 'text-emerald-400' : ''}`} />
          <span>Settings</span>
        </button>
      </div>

      {/* Right: Live Speed Telemetry + Quick Actions */}
      <div className="flex items-center space-x-2 [-webkit-app-region:no-drag]">
        {hasTraffic && (
          <div className="hidden lg:flex items-center space-x-2 px-2.5 py-1 rounded-full bg-card/90 border border-border/60 text-[11px] font-mono tabular-nums shadow-xs">
            <span className="text-emerald-400 font-bold flex items-center space-x-1">
              <span className="text-[9.5px]">↓</span>
              <span>{formatCompactSpeed(totalDownloadSpeed, speedUnit)}</span>
            </span>
            <span className="text-muted-foreground/40">|</span>
            <span className="text-cyan-400 font-bold flex items-center space-x-1">
              <span className="text-[9.5px]">↑</span>
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
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 active:scale-95 transition-all"
                aria-label="Scan Networks"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isScanning || interfacesStatus === 'loading' ? 'animate-spin text-emerald-400' : ''}`}
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
                className="flex h-7 items-center space-x-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold px-2.5 text-xs active:scale-95 transition-all shadow-xs"
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
