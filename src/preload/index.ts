import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import { IpcChannels } from '../shared/ipc-channels'
import type { IpcContract } from '../shared/ipc-contract'
import type { BondingState, BondingStrategy } from '../shared/bondingTypes'
import type {
  AppSettings,
  DownloadUpdate,
  InitialState,
  MagnetCheckStatus,
  NetworkInterfaceInfo,
  UpdateState
} from '../shared/types'

/** Typed wrapper around ipcRenderer.invoke — the channel name picks its args/result shape out of
 * IpcContract, so a call here that doesn't match what registerIpcHandlers (main) actually handles
 * is a compile error instead of a silent runtime mismatch. */
function invoke<K extends keyof IpcContract>(
  channel: K,
  ...args: IpcContract[K]['args']
): Promise<IpcContract[K]['result']> {
  return ipcRenderer.invoke(IpcChannels[channel], ...args)
}

const plexoApi = {
  platform: process.platform,
  // Sync on purpose — see InitialState. One small read, once, before the renderer's first paint.
  initialState: ipcRenderer.sendSync(IpcChannels.getInitialState) as InitialState,

  listInterfaces: () => invoke('listInterfaces'),
  deviceBindingSupported: () => invoke('deviceBindingSupported'),
  openNetworkSettings: () => invoke('openNetworkSettings'),
  updateSettings: (patch: AppSettings) => invoke('updateSettings', patch),
  probeUrl: (url: string) => invoke('probeUrl', url),
  chooseDestinationFolder: (defaultPath: string) => invoke('chooseDestinationFolder', defaultPath),
  chooseTorrentFile: () => invoke('chooseTorrentFile'),
  /** Where a file dropped on the window is on disk ('' for one that isn't a file). */
  pathForFile: (file: File) => webUtils.getPathForFile(file),
  readClipboardText: () => invoke('readClipboardText'),
  revealDownload: (id: string) => invoke('revealDownload', id),
  openDownload: (id: string) => invoke('openDownload', id),
  startDownload: (request: IpcContract['startDownload']['args'][0], linkId?: string) =>
    invoke('startDownload', request, linkId),
  listDownloads: () => invoke('listDownloads'),
  listHistory: () => invoke('listHistory'),
  clearHistory: () => invoke('clearHistory'),
  networkUsage: () => invoke('networkUsage'),
  resetNetworkUsage: (id) => invoke('resetNetworkUsage', id),
  freeSpace: (dir: string) => invoke('freeSpace', dir),
  torrentFiles: (downloadId: string) => invoke('torrentFiles', downloadId),
  chooseTorrentFiles: (downloadId: string, selected: number[]) =>
    invoke('chooseTorrentFiles', downloadId, selected),
  pauseDownload: (downloadId: string) => invoke('pauseDownload', downloadId),
  resumeDownload: (downloadId: string) => invoke('resumeDownload', downloadId),
  relinkDownload: (downloadId: string, url: string) => invoke('relinkDownload', downloadId, url),
  setDownloadNetwork: (downloadId: string, networkId: string, enabled: boolean) =>
    invoke('setDownloadNetwork', downloadId, networkId, enabled),
  cancelDownload: (downloadId: string) => invoke('cancelDownload', downloadId),
  removeDownload: (downloadId: string, options?: { trashFile?: boolean }) =>
    invoke('removeDownload', downloadId, options),
  updateState: () => invoke('updateState'),
  showUpdateMenu: () => invoke('showUpdateMenu'),
  pendingLinks: () => invoke('pendingLinks'),
  resumeFromLink: (linkId: string, downloadId: string) =>
    invoke('resumeFromLink', linkId, downloadId),
  dismissLink: (id: string) => invoke('dismissLink', id),

  /** pendingLinks() has the new link. */
  onLinkReceived: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on(IpcChannels.linkReceived, listener)
    return () => ipcRenderer.removeListener(IpcChannels.linkReceived, listener)
  },

  onDownloadUpdated: (callback: (update: DownloadUpdate) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, update: DownloadUpdate): void => callback(update)
    ipcRenderer.on(IpcChannels.downloadUpdated, listener)
    return () => ipcRenderer.removeListener(IpcChannels.downloadUpdated, listener)
  },

  /** A download was added to the finished ones or forgotten: listHistory() has them. */
  onHistoryChanged: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on(IpcChannels.historyChanged, listener)
    return () => ipcRenderer.removeListener(IpcChannels.historyChanged, listener)
  },

  onUpdateState: (callback: (state: UpdateState) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, state: UpdateState): void => callback(state)
    ipcRenderer.on(IpcChannels.updateStateChanged, listener)
    return () => ipcRenderer.removeListener(IpcChannels.updateStateChanged, listener)
  },

  onNetworksChanged: (callback: (networks: NetworkInterfaceInfo[]) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, networks: NetworkInterfaceInfo[]): void =>
      callback(networks)
    ipcRenderer.on(IpcChannels.networksChanged, listener)
    return () => ipcRenderer.removeListener(IpcChannels.networksChanged, listener)
  },

  onMagnetCheckStatus: (callback: (status: MagnetCheckStatus) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, status: MagnetCheckStatus): void => callback(status)
    ipcRenderer.on(IpcChannels.magnetCheckStatus, listener)
    return () => ipcRenderer.removeListener(IpcChannels.magnetCheckStatus, listener)
  },

  startBonding: () => invoke('startBonding'),
  stopBonding: () => invoke('stopBonding'),
  getBondingState: () => invoke('getBondingState'),
  setBondingStrategy: (strategy: BondingStrategy) => invoke('setBondingStrategy', strategy),
  toggleSystemProxy: (enable?: boolean) => invoke('toggleSystemProxy', enable),
  runSpeedTest: () => invoke('runSpeedTest'),
  openMainWindow: () => invoke('openMainWindow'),
  hideTrayWindow: () => invoke('hideTrayWindow'),
  quitApp: () => invoke('quitApp'),

  onBondingStateChanged: (callback: (state: BondingState) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, state: BondingState): void => callback(state)
    ipcRenderer.on(IpcChannels.bondingStateChanged, listener)
    return () => ipcRenderer.removeListener(IpcChannels.bondingStateChanged, listener)
  }
}

export type VelnqorApi = typeof plexoApi
export type PlexoApi = VelnqorApi

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('velnqor', plexoApi)
    contextBridge.exposeInMainWorld('plexo', plexoApi)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (assign fallback on non-contextIsolated window object)
  window.velnqor = plexoApi
  // @ts-ignore (assign legacy fallback on non-contextIsolated window object)
  window.plexo = plexoApi
}
