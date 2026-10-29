import { useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'

export function useBondingEvents(): void {
  const receiveBondingState = useAppStore((state) => state.receiveBondingState)
  const loadBondingState = useAppStore((state) => state.loadBondingState)

  useEffect(() => {
    void loadBondingState()

    const unsubscribe = window.velnqor?.onBondingStateChanged?.((state) => {
      receiveBondingState(state)
    })

    return () => {
      unsubscribe?.()
    }
  }, [loadBondingState, receiveBondingState])
}
