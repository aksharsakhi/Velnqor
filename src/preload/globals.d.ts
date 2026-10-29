import type { VelnqorApi } from './index'

declare global {
  interface Window {
    plexo: VelnqorApi
    velnqor: VelnqorApi
  }
}
