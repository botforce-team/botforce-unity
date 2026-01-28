'use client'

import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Client-side error boundary component
 * Catches JavaScript errors in child components and displays a fallback UI
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log to console
    console.error('ErrorBoundary caught an error:', error, errorInfo)

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo)

    // In production, send to error tracking service
    // e.g., Sentry.captureException(error, { extra: errorInfo })
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Return custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default fallback UI
      return (
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-danger/20 bg-danger/5 p-6">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger-muted">
              <AlertTriangle className="h-6 w-6 text-danger" />
            </div>
            <h3 className="mb-2 text-lg font-medium text-text-primary">
              Something went wrong
            </h3>
            <p className="mb-4 text-sm text-text-secondary">
              This section encountered an error and couldn&apos;t be displayed.
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <pre className="mb-4 max-w-md overflow-auto rounded bg-surface p-2 text-left text-xs text-danger">
                {this.state.error.message}
              </pre>
            )}
            <Button onClick={this.handleReset} size="sm" variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * HOC to wrap components with error boundary
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode
): React.FC<P> {
  const WithErrorBoundary: React.FC<P> = (props) => (
    <ErrorBoundary fallback={fallback}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  )

  WithErrorBoundary.displayName = `WithErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`

  return WithErrorBoundary
}

/**
 * Simple inline error fallback for smaller components
 */
export function InlineErrorFallback({
  message = 'Failed to load',
  onRetry,
}: {
  message?: string
  onRetry?: () => void
}): JSX.Element {
  return (
    <div className="inline-flex items-center gap-2 rounded bg-danger-muted px-3 py-1.5 text-sm text-danger">
      <AlertTriangle className="h-4 w-4" />
      <span>{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="ml-2 underline hover:no-underline"
        >
          Retry
        </button>
      )}
    </div>
  )
}
