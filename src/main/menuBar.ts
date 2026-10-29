import { app, BrowserWindow, Menu, nativeImage, Tray } from 'electron'
import trayTemplateIcon from '../../resources/trayTemplate.png?asset'
import type { BondingManager } from './bonding/bondingManager'
import type { DownloadManager } from './download/downloadManager'
import { loadSettings, saveSettings } from './settings'
import { bringForward } from './openLinks'

/**
 * Manages the macOS menu bar (status bar) control and background execution state.
 * Allows users to enable or disable background bonding and downloads directly from the menu bar,
 * keeping the application alive and functional even when the main window is closed.
 */
export class MenuBarManager {
  private tray: Tray | null = null
  private backgroundActivityEnabled = true
  private getWindow: () => BrowserWindow | null
  private ensureWindow: () => BrowserWindow
  private bondingManager: () => BondingManager | null
  private downloadManager: () => DownloadManager | null
  private pollTimer: NodeJS.Timeout | null = null

  constructor(options: {
    getWindow: () => BrowserWindow | null
    ensureWindow: () => BrowserWindow
    bondingManager: () => BondingManager | null
    downloadManager: () => DownloadManager | null
  }) {
    this.getWindow = options.getWindow
    this.ensureWindow = options.ensureWindow
    this.bondingManager = options.bondingManager
    this.downloadManager = options.downloadManager
  }

  async init(): Promise<void> {
    const settings = await loadSettings()
    this.backgroundActivityEnabled = settings.backgroundActivityEnabled !== false

    this.createTray()

    // Periodically sync live status (throughput, active download count) in the menu
    this.pollTimer = setInterval(() => {
      this.updateMenu()
    }, 2500)
  }

  isBackgroundActivityEnabled(): boolean {
    return this.backgroundActivityEnabled
  }

  private createTray(): void {
    if (this.tray) return

    const img = nativeImage.createFromPath(trayTemplateIcon)
    if (process.platform === 'darwin') {
      img.setTemplateImage(true)
    }

    this.tray = new Tray(img)
    this.tray.setToolTip('Velnqor — Multi-Network Bonding & Download Accelerator')
    this.tray.setIgnoreDoubleClickEvents(true)

    this.tray.on('click', () => {
      const win = this.getWindow()
      if (win && win.isVisible() && !win.isMinimized()) {
        this.tray?.popUpContextMenu()
      } else {
        const target = this.ensureWindow()
        bringForward(target)
      }
    })

    this.updateMenu()
  }

  updateMenu(): void {
    if (!this.tray || this.tray.isDestroyed()) return

    const win = this.getWindow()
    const isWindowVisible = win && !win.isDestroyed() && win.isVisible()

    const bonding = this.bondingManager()
    const bondingState = bonding?.getState()
    const bondingActive = bondingState?.active ?? false
    const bondingThroughput = bondingState
      ? bondingState.totalDownloadSpeed + bondingState.totalUploadSpeed
      : 0

    const downloadMgr = this.downloadManager()
    const activeDownloads = downloadMgr ? downloadMgr.getActiveCount() : 0

    const statusTitle = this.backgroundActivityEnabled
      ? bondingActive
        ? `Velnqor: Bonding (${this.formatBytes(bondingThroughput)}/s)`
        : activeDownloads > 0
          ? `Velnqor: Downloading (${activeDownloads} active)`
          : 'Velnqor: Background Ready'
      : 'Velnqor: Background Disabled'

    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: statusTitle,
        enabled: false
      },
      {
        label: isWindowVisible ? 'Hide Velnqor' : 'Open Velnqor',
        click: () => {
          if (isWindowVisible) {
            win?.hide()
          } else {
            const target = this.ensureWindow()
            bringForward(target)
          }
          this.updateMenu()
        }
      },
      { type: 'separator' },
      {
        label: 'Background Activity',
        type: 'checkbox',
        checked: this.backgroundActivityEnabled,
        click: async (menuItem) => {
          await this.setBackgroundActivity(menuItem.checked)
        }
      },
      {
        label: bondingActive ? 'Unified Bonding: Active' : 'Unified Bonding: Stopped',
        type: 'checkbox',
        checked: bondingActive,
        enabled: this.backgroundActivityEnabled,
        click: async () => {
          const bm = this.bondingManager()
          if (!bm) return
          if (bondingActive) {
            await bm.stop()
          } else {
            await bm.start()
          }
          this.updateMenu()
        }
      },
      {
        label: activeDownloads > 0 ? `Active Downloads: ${activeDownloads}` : 'No Active Downloads',
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'Quit Velnqor',
        click: () => {
          app.quit()
        }
      }
    ]

    this.tray.setContextMenu(Menu.buildFromTemplate(template))
  }

  async setBackgroundActivity(enabled: boolean): Promise<void> {
    this.backgroundActivityEnabled = enabled
    await saveSettings({ backgroundActivityEnabled: enabled })

    const bm = this.bondingManager()
    const dm = this.downloadManager()

    if (!enabled) {
      // Background activity disabled: stop background proxy and pause active downloads
      if (bm && bm.getState().active) {
        await bm.stop()
      }
      if (dm) {
        await dm.pauseActiveDownloads()
      }
    }

    this.updateMenu()
  }

  destroy(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    if (this.tray && !this.tray.isDestroyed()) {
      this.tray.destroy()
      this.tray = null
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes <= 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB']
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
  }
}
