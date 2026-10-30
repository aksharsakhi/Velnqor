import type { DownloadState, FinishedDownload } from '@shared/types'
import type { DownloadFilter } from '../store/useAppStore'

export type Item = DownloadState | FinishedDownload

export interface Group {
  label: string
  items: Item[]
}

export function filterOf(item: Item): Exclude<DownloadFilter, 'all'> {
  if ('unitsWritten' in item || item.status === 'completed') return 'finished'
  return item.status === 'error' ? 'failed' : 'progress'
}

export function groupsOf(downloads: DownloadState[], history: FinishedDownload[]): Group[] {
  const byStatus = (status: DownloadState['status']): DownloadState[] =>
    downloads.filter((download) => download.status === status)
  return [
    { label: 'Downloading', items: byStatus('downloading') },
    {
      label: 'Queued',
      items: byStatus('queued').sort((a, b) => (a.queuedAt ?? 0) - (b.queuedAt ?? 0))
    },
    { label: 'Paused', items: byStatus('paused') },
    { label: 'Needs attention', items: byStatus('error') },
    // Completed but not in history yet: on its way there, so listed with it.
    { label: 'Finished', items: [...byStatus('completed'), ...history] }
  ].filter((group) => group.items.length > 0)
}

/** "2 downloading · 1 queued", or "all done". */
export function summaryOf(downloads: DownloadState[]): string {
  const count = (status: DownloadState['status']): number =>
    downloads.filter((download) => download.status === status).length
  const parts = [
    [count('downloading'), 'downloading'],
    [count('queued'), 'queued'],
    [count('paused'), 'paused'],
    [count('error'), 'need attention']
  ]
    .filter(([n]) => (n as number) > 0)
    .map(([n, label]) => `${n} ${label}`)
  return parts.length > 0 ? parts.join(' · ') : 'all done'
}

export const groupLabelClass =
  'font-mono text-[10.5px] leading-none font-medium tracking-[0.18em] text-muted-foreground uppercase'

export const NOT_CHOSEN: Item[] = []
