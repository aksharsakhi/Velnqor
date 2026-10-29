import React from 'react'
import { TITLE_BAR_HEIGHT } from '../theme'
import { useAppStore } from '../store/useAppStore'
import { Zap, DownloadCloud } from 'lucide-react'
import logoImg from '../assets/velnqor-logo.png'

const isMac = (window.velnqor || window.plexo).platform === 'darwin'

/** The window's title bar: brand name with new Velnqor logo, centered tabs between System Bonding and Downloads. */
export function TitleBar(): React.JSX.Element {
  const activeTab = useAppStore((state) => state.activeTab)
  const setActiveTab = useAppStore((state) => state.setActiveTab)
  const bondingActive = useAppStore((state) => state.bondingState.active)

  return (
    <div
      style={{ height: TITLE_BAR_HEIGHT }}
      className={`flex shrink-0 items-center justify-between border-b-[0.5px] border-border bg-card/90 backdrop-blur-md [-webkit-app-region:drag] ${
        isMac ? 'pl-[86px] pr-4' : 'px-4'
      }`}
    >
      {/* Brand title with New Logo */}
      <div className="flex items-center space-x-2.5">
        <img
          src={logoImg}
          alt="Velnqor"
          className="h-5.5 w-5.5 rounded-lg shadow-sm object-cover ring-1 ring-emerald-500/25"
        />
        <div className="flex items-center space-x-1.5">
          <span className="font-sans text-[13.5px] font-bold tracking-tight text-foreground">
            Velnqor
          </span>
          <span className="hidden sm:inline-block text-[9.5px] uppercase font-bold tracking-wider text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 rounded">
            Bonding
          </span>
        </div>
      </div>

      {/* Segmented Switcher */}
      <div className="flex items-center rounded-lg bg-muted/60 p-0.5 border border-border/50 [-webkit-app-region:no-drag]">
        <button
          onClick={() => setActiveTab('bonding')}
          className={`flex items-center space-x-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-all ${
            activeTab === 'bonding'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Zap
            className={`h-3.5 w-3.5 ${
              bondingActive
                ? 'text-emerald-500 fill-emerald-500 animate-pulse'
                : 'text-muted-foreground'
            }`}
          />
          <span>Unified Bonding</span>
          {bondingActive && (
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping ml-0.5" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('downloads')}
          className={`flex items-center space-x-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-all ${
            activeTab === 'downloads'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <DownloadCloud className="h-3.5 w-3.5" />
          <span>Downloads Queue</span>
        </button>
      </div>

      <div className="w-12" />
    </div>
  )
}
