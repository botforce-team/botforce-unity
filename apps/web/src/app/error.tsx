'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Log error to console in development
    console.error('Page Error:', error)

    // In production, you would send this to an error tracking service
    // e.g., Sentry, LogRocket, etc.
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-danger-muted">
          <AlertTriangle className="h-8 w-8 text-danger" />
        </div>

        <h1 className="mb-2 text-2xl font-semibold text-text-primary">
          Something went wrong
        </h1>

        <p className="mb-6 text-text-secondary">
          We encountered an unexpected error. Our team has been notified and is working on a fix.
        </p>

        {process.env.NODE_ENV === 'development' && (
          <div className="mb-6 rounded-lg bg-surface p-4 text-left">
            <p className="mb-2 text-sm font-medium text-text-primary">
              Error Details (Development Only):
            </p>
            <pre className="overflow-auto text-xs text-danger">
              {error.message}
            </pre>
            {error.digest && (
              <p className="mt-2 text-xs text-text-muted">
                Error ID: {error.digest}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={reset} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
          <Link href="/dashboard">
            <Button>
              <Home className="mr-2 h-4 w-4" />
              Go to Dashboard
            </Button>
          </Link>
        </div>

        <p className="mt-8 text-sm text-text-muted">
          If this problem persists, please contact support.
        </p>
      </div>
    </div>
  )
}
