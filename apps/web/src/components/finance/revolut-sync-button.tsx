'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface RevolutSyncButtonProps {
  isConnected: boolean
}

export function RevolutSyncButton({ isConnected }: RevolutSyncButtonProps) {
  const [isSyncing, setIsSyncing] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  if (!isConnected) return null

  const handleSync = async () => {
    setIsSyncing(true)
    setResult(null)

    try {
      const response = await fetch('/api/revolut/sync', { method: 'POST' })
      const data = await response.json()

      if (data.success) {
        setResult({
          success: true,
          message: `Synced ${data.accounts_synced} accounts, ${data.transactions_synced} transactions`,
        })
        // Refresh page after short delay to show updated data
        setTimeout(() => window.location.reload(), 1500)
      } else {
        setResult({ success: false, message: data.error || 'Sync failed' })
      }
    } catch {
      setResult({ success: false, message: 'Failed to sync. Please try again.' })
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {result && (
        <span className={`text-xs ${result.success ? 'text-success' : 'text-danger'}`}>
          {result.message}
        </span>
      )}
      <Button onClick={handleSync} disabled={isSyncing} variant="outline" size="sm">
        <RefreshCw className={`h-4 w-4 mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
        {isSyncing ? 'Syncing...' : 'Sync Revolut'}
      </Button>
    </div>
  )
}
