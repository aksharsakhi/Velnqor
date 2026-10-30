import React from 'react'
import { TITLE_BAR_HEIGHT } from '../theme'
import { useAppStore } from '../store/useAppStore'
import { VelnqorLogo } from './VelnqorLogo'
import { formatBytes } from '../utils/format'

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

/** The window's title bar: brand name, SVG logo, bonding status pill, and live speed telemetry. */
export function TitleBar(): React.JSX.Element {
  const bondingActive = useAppStore((state) => state.bondingState.active)
  const totalDownloadSpeed = useAppStore((state) => state.bondingState.totalDownloadSpeed)
  const totalUploadSpeed = useAppStore((state) => state.bondingState.totalUploadSpeed)
  const speedUnit = useAppStore((state) => state.speedUnit)

  const hasTraffic = totalDownloadSpeed > 0 || totalUploadSpeed > 0

  return (
    <div
      style={{ height: TITLE_BAR_HEIGHT }}
      className={`relative flex shrink-0 items-center justify-between border-b-[0.5px] border-border bg-card/90 backdrop-blur-md [-webkit-app-region:drag] ${
        isMac ? 'pl-[86px] pr-4' : 'px-4'
      }`}
    >
      {/* Brand title with Clean SVG Logo + Bonding Status Pill */}
      <div className="flex items-center space-x-2.5">
        <VelnqorLogo className="h-5.5 w-5.5 rounded-lg shadow-xs ring-1 ring-emerald-500/25" />
        <div className="flex items-center space-x-2">
          <span className="font-sans text-[13.5px] font-bold tracking-tight text-foreground">
            Velnqor
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9.5px] font-bold tracking-wide uppercase ${
              bondingActive
                ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                : 'bg-muted text-muted-foreground border border-border'
            }`}
          >
            <span
              className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
                bondingActive ? 'bg-emerald-500 animate-ping' : 'bg-muted-foreground'
              }`}
            />
            {bondingActive ? 'Bonding Active' : 'Multi-WAN Standby'}
          </span>
        </div>
      </div>

      {/* Center Live Speed Telemetry (Mathematically Centered) */}
      {hasTraffic && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:flex items-center space-x-2 px-3 py-0.5 rounded-full bg-muted/60 border border-border/50 text-[11px] font-mono shadow-xs">
          <span className="text-emerald-500 font-semibold">
            ↓ {formatCompactSpeed(totalDownloadSpeed, speedUnit)}
          </span>
          <span className="text-muted-foreground opacity-40">|</span>
          <span className="text-blue-500 font-semibold">
            ↑ {formatCompactSpeed(totalUploadSpeed, speedUnit)}
          </span>
        </div>
      )}

      {/* Right Spacer */}
      <div className="w-8" />
    </div>
  )
}
