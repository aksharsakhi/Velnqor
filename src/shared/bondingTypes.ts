import type { NetworkInterfaceKind } from './types'

export type BondingStrategy = 'adaptive' | 'round_robin' | 'speed_boost' | 'failover'

export type BondingStatus = 'idle' | 'starting' | 'active' | 'stopping' | 'error'

export interface InterfaceBondingMetric {
  id: string
  name: string
  device: string
  kind: NetworkInterfaceKind
  ip: string
  status: 'healthy' | 'degraded' | 'offline'
  latencyMs: number
  downloadSpeedBytesPerSec: number
  uploadSpeedBytesPerSec: number
  totalBytesDownloaded: number
  totalBytesUploaded: number
  activeFlowCount: number
  weight: number
}

export interface ActiveFlow {
  id: string
  host: string
  port: number
  protocol: 'HTTP' | 'HTTPS' | 'SOCKS5'
  interfaceId: string
  interfaceName: string
  startTime: number
  bytesTransferred: number
  speedBytesPerSec: number
  active: boolean
}

export interface BondingState {
  active: boolean
  status: BondingStatus
  strategy: BondingStrategy
  httpPort: number
  socksPort: number
  systemProxyActive: boolean
  totalDownloadSpeed: number
  totalUploadSpeed: number
  sessionTotalBytesDown: number
  sessionTotalBytesUp: number
  isSpeedTesting: boolean
  interfaces: Record<string, InterfaceBondingMetric>
  recentFlows: ActiveFlow[]
  error: string | null
}

