import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallbackTitle?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[Velnqor ErrorBoundary caught]:', error, errorInfo)
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex h-full flex-col items-center justify-center p-8 text-center text-foreground bg-background">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20 mb-4 shadow-sm">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h2 className="text-base font-bold tracking-tight">
            {this.props.fallbackTitle || 'Unable to display view'}
          </h2>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-md font-mono bg-muted/40 p-2.5 rounded-lg border border-border/50">
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <button
            onClick={this.handleReset}
            className="mt-4 flex items-center space-x-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-md transition-all active:scale-95"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Reload View</span>
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
