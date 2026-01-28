'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import { RefreshCw, Link2, Unlink, CheckCircle2, AlertCircle, Clock } from 'lucide-react'
import type { RevolutConnectionInfo } from '@/app/actions/revolut'

interface RevolutSettingsProps {
  connection: RevolutConnectionInfo | null
}

export function RevolutSettings({ connection }: RevolutSettingsProps) {
  const [isSyncing, setIsSyncing] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleConnect = () => {
    setIsConnecting(true)
    setError(null)
    // Redirect to OAuth flow
    window.location.href = '/api/revolut/auth'
  }

  const handleSync = async () => {
    setIsSyncing(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/revolut/sync', { method: 'POST' })
      const result = await response.json()

      if (result.success) {
        setSuccess(`Synced ${result.accounts_synced} accounts and ${result.transactions_synced} transactions`)
        // Refresh the page after a short delay to show updated data
        setTimeout(() => window.location.reload(), 2000)
      } else {
        setError(result.error || 'Sync failed')
      }
    } catch (err) {
      setError('Failed to sync. Please try again.')
    } finally {
      setIsSyncing(false)
    }
  }

  const handleDisconnect = async (deleteData: boolean) => {
    const confirmMessage = deleteData
      ? 'Are you sure you want to disconnect Revolut and delete all synced data? This cannot be undone.'
      : 'Are you sure you want to disconnect Revolut? Your synced data will be kept for historical purposes.'

    if (!confirm(confirmMessage)) return

    setIsDisconnecting(true)
    setError(null)

    try {
      const response = await fetch('/api/revolut/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteData }),
      })
      const result = await response.json()

      if (result.success) {
        window.location.reload()
      } else {
        setError(result.error || 'Failed to disconnect')
      }
    } catch (err) {
      setError('Failed to disconnect. Please try again.')
    } finally {
      setIsDisconnecting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Connected</Badge>
      case 'expired':
        return <Badge variant="warning">Token Expired</Badge>
      case 'revoked':
        return <Badge variant="secondary">Disconnected</Badge>
      case 'error':
        return <Badge variant="danger">Error</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const getSyncStatusIcon = (status: string | null) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-success" />
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-danger" />
      case 'syncing':
        return <RefreshCw className="h-4 w-4 text-info animate-spin" />
      default:
        return <Clock className="h-4 w-4 text-text-muted" />
    }
  }

  // Not connected state
  if (!connection || connection.status === 'revoked') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 bg-[#0666EB]/10 rounded-lg">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="#0666EB">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            Revolut Business
          </CardTitle>
          <CardDescription>
            Connect your Revolut Business account to sync transactions and view balances
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 bg-danger-muted text-danger text-sm rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-2 text-sm text-text-secondary">
            <p>By connecting, you'll be able to:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>View all your Revolut account balances</li>
              <li>Automatically sync transactions</li>
              <li>Reconcile transactions with expenses and invoices</li>
              <li>Initiate payments directly from the app</li>
            </ul>
          </div>

          <Button onClick={handleConnect} disabled={isConnecting} className="w-full sm:w-auto">
            <Link2 className="h-4 w-4 mr-2" />
            {isConnecting ? 'Connecting...' : 'Connect Revolut Business'}
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Connected state
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-3">
            <div className="p-2 bg-[#0666EB]/10 rounded-lg">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="#0666EB">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            Revolut Business
          </span>
          {getStatusBadge(connection.status)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 bg-danger-muted text-danger text-sm rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 bg-success-muted text-success text-sm rounded-lg">
            {success}
          </div>
        )}

        <div className="grid gap-3 text-sm">
          <div className="flex justify-between py-2 border-b border-surface-border">
            <span className="text-text-secondary">Connected</span>
            <span>{formatDateTime(connection.connected_at)}</span>
          </div>

          {connection.last_sync_at && (
            <div className="flex justify-between py-2 border-b border-surface-border">
              <span className="text-text-secondary">Last Sync</span>
              <span className="flex items-center gap-2">
                {getSyncStatusIcon(connection.last_sync_status)}
                {formatDateTime(connection.last_sync_at)}
              </span>
            </div>
          )}

          {connection.last_sync_error && (
            <div className="p-3 bg-danger-muted text-danger text-sm rounded-lg">
              Last sync error: {connection.last_sync_error}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            onClick={handleSync}
            disabled={isSyncing || connection.status !== 'active'}
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </Button>

          <Button
            onClick={() => handleDisconnect(false)}
            disabled={isDisconnecting}
            variant="ghost"
            className="text-text-secondary hover:text-danger"
          >
            <Unlink className="h-4 w-4 mr-2" />
            Disconnect
          </Button>
        </div>

        {connection.status === 'expired' && (
          <div className="p-3 bg-warning-muted text-warning text-sm rounded-lg">
            Your access token has expired. Please reconnect to continue syncing.
            <Button onClick={handleConnect} size="sm" className="ml-2">
              Reconnect
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
