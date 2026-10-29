import type { DownloadState, FinishedDownload } from '@shared/types'
import { DownloadActionsProvider } from './components/DownloadActionsProvider'
import { NetworkBindingDialog } from './components/NetworkBindingDialog'
import { NewDownloadDialog } from './components/NewDownloadDialog'
import { StatusBar } from './components/StatusBar'
import { TitleBar } from './components/TitleBar'
import { TooltipProvider } from './components/ui/tooltip'
import { useDownloadEvents } from './hooks/useDownloadEvents'
import { useNetworkEvents } from './hooks/useNetworks'
import { useNewDownloadShortcuts, useOpenedLinks } from './hooks/useOpenedLinks'
import { CompleteScreen } from './screens/CompleteScreen'
import { DownloadingScreen } from './screens/DownloadingScreen'
import { DownloadsScreen } from './screens/DownloadsScreen'
import { ErrorScreen } from './screens/ErrorScreen'
import { BondingDashboardScreen } from './screens/BondingDashboardScreen'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useBondingEvents } from './hooks/useBondingEvents'
import { useAppStore } from './store/useAppStore'

function assertNever(status: never): never {
  throw new Error(`Unhandled download status: ${String(status)}`)
}

/** One screen per download.status — a switch with an assertNever default so a new
 * DownloadStatus value is a compile error here instead of silently falling into whichever branch
 * happened to be last. */
function renderDownload(download: DownloadState | FinishedDownload): React.JSX.Element {
  if ('unitsWritten' in download) return <CompleteScreen download={download} />
  switch (download.status) {
    case 'queued':
    case 'downloading':
    case 'paused':
      return <DownloadingScreen download={download} />
    case 'completed':
      return <CompleteScreen download={download} />
    case 'error':
    case 'cancelled':
      return <ErrorScreen download={download} />
    default:
      return assertNever(download.status)
  }
}

/** The screen shown: bonding dashboard, download detail, or download list. */
function CurrentScreen(): React.JSX.Element {
  const view = useAppStore((store) => store.view)
  const shown = useAppStore((store) => {
    if (view.name !== 'download') return null
    return store.downloads[view.id] ?? store.history.find((entry) => entry.id === view.id) ?? null
  })

  if (view.name === 'bonding') {
    return <BondingDashboardScreen />
  }

  const cancelled = shown && !('unitsWritten' in shown) && shown.status === 'cancelled'
  return shown && !cancelled ? renderDownload(shown) : <DownloadsScreen />
}

function App(): React.JSX.Element {
  useDownloadEvents()
  useOpenedLinks()
  useNewDownloadShortcuts()
  useNetworkEvents()
  useBondingEvents()

  return (
    <TooltipProvider>
      <DownloadActionsProvider>
        <div className="flex h-full flex-col">
          <TitleBar />
          <div className="min-h-0 flex-1">
            <ErrorBoundary>
              <CurrentScreen />
            </ErrorBoundary>
          </div>

          <StatusBar />
          <NewDownloadDialog />
          <NetworkBindingDialog />
        </div>
      </DownloadActionsProvider>
    </TooltipProvider>
  )
}

export default App
