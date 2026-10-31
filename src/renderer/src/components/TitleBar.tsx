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
 * The window's unified Apple HIG Title Bar:
 * - Functional Liquid Glass floating layer
 * - Brand logo with subtle active glow
 * - Status capsule badge
 * - Tabular-numbered live aggregate throughput (mathematically centered)
 * - Native tactile quick-action buttons (New Download, Scan Networks)
 */
export function TitleBar(): React.JSX.Element {
  const bondingActive = useAppStore((state) => state.bondingState.active)
  const totalDownloadSpeed = useAppStore((state) => state.bondingState.totalDownloadSpeed)
  const totalUploadSpeed = useAppStore((state) => state.bondingState.totalUploadSpeed)
  const speedUnit = useAppStore((state) => state.speedUnit)
  const openNewDownload = useAppStore((state) => state.openNewDownload)
  const loadInterfaces = useAppStore((state) => state.loadInterfaces)
  const interfacesStatus = useAppStore((state) => state.interfacesStatus)

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
      className={`relative flex shrink-0 items-center justify-between border-b border-border/60 bg-card/80 backdrop-blur-xl select-none [-webkit-app-region:drag] ${
        isMac ? 'pl-[84px] pr-3.5' : 'px-3.5'
      }`}
    >
      {/* Brand title with Clean SVG Logo + Bonding Status Pill */}
      <div className="flex items-center space-x-2.5">
        <div className="relative flex items-center justify-center">
          <VelnqorLogo className="h-5 w-5 rounded-lg shadow-xs ring-1 ring-emerald-500/25" />
          {bondingActive && (
            <span className="absolute -inset-0.5 rounded-lg bg-emerald-500/20 blur-xs -z-10 animate-pulse" />
          )}
        </div>
        <div className="flex items-center space-x-2">
          <span className="font-sans text-[13px] font-bold tracking-[-0.015em] text-foreground">
            Velnqor
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9.5px] font-semibold tracking-wide transition-all ${
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

      {/* Center Live Speed Telemetry (Mathematically Centered, Emil Kowalski anti-jitter tabular numbers) */}
      {hasTraffic && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:flex items-center space-x-2 px-3 py-1 rounded-full bg-card/80 border border-border/60 text-[11px] font-mono tabular-nums shadow-xs backdrop-blur-md">
          <span className="text-emerald-400 font-semibold flex items-center space-x-1">
            <span className="text-[10px]">↓</span>
            <span>{formatCompactSpeed(totalDownloadSpeed, speedUnit)}</span>
          </span>
          <span className="text-muted-foreground/40">|</span>
          <span className="text-cyan-400 font-semibold flex items-center space-x-1">
            <span className="text-[10px]">↑</span>
            <span>{formatCompactSpeed(totalUploadSpeed, speedUnit)}</span>
          </span>
        </div>
      )}

      {/* Right Side Quick Action Controls (Non-drag region with tactile feedback) */}
      <div className="flex items-center space-x-1.5 [-webkit-app-region:no-drag]">
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
                className="flex h-7 items-center space-x-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 px-2 text-xs font-semibold active:scale-95 transition-all shadow-2xs"
                aria-label="New Download"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline text-[11px]">New Download</span>
              </button>
            }
          />
          <TooltipContent>Add URL, Magnet, or File</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
