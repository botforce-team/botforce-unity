'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { Wallet, TrendingUp, TrendingDown, Building2 } from 'lucide-react'
import Link from 'next/link'
import type { RevolutAccountInfo } from '@/app/actions/revolut'

interface RevolutBalanceCardProps {
  accounts: RevolutAccountInfo[]
  balances: Record<string, number>
  isConnected: boolean
}

export function RevolutBalanceCard({ accounts, balances, isConnected }: RevolutBalanceCardProps) {
  // Not connected state
  if (!isConnected) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Wallet className="h-4 w-4 text-text-muted" />
            Bank Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <div className="text-text-secondary text-sm mb-3">
              Connect your Revolut Business account to view balances
            </div>
            <Link
              href="/settings?tab=integrations"
              className="text-primary hover:underline text-sm font-medium"
            >
              Connect Revolut
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Calculate total in primary currency (EUR)
  const primaryCurrency = 'EUR'
  const primaryBalance = balances[primaryCurrency] || 0

  // Get other currency balances
  const otherBalances = Object.entries(balances).filter(([currency]) => currency !== primaryCurrency)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            Bank Balance
          </span>
          <Badge variant="success" className="text-xs">
            Live
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Primary balance */}
        <div>
          <div className="text-3xl font-bold text-text-primary">
            {formatCurrency(primaryBalance, primaryCurrency)}
          </div>
          <div className="text-sm text-text-muted mt-1">
            Total {primaryCurrency} balance
          </div>
        </div>

        {/* Other currency balances */}
        {otherBalances.length > 0 && (
          <div className="pt-3 border-t border-surface-border">
            <div className="text-xs text-text-muted mb-2 uppercase tracking-wide">
              Other Currencies
            </div>
            <div className="space-y-2">
              {otherBalances.map(([currency, amount]) => (
                <div key={currency} className="flex justify-between items-center">
                  <span className="text-sm text-text-secondary">{currency}</span>
                  <span className="text-sm font-medium">
                    {formatCurrency(amount, currency)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Individual accounts */}
        {accounts.length > 1 && (
          <div className="pt-3 border-t border-surface-border">
            <div className="text-xs text-text-muted mb-2 uppercase tracking-wide">
              Accounts
            </div>
            <div className="space-y-2">
              {accounts.slice(0, 4).map((account) => (
                <div
                  key={account.id}
                  className="flex justify-between items-center"
                >
                  <span className="text-sm text-text-secondary flex items-center gap-2">
                    <Building2 className="h-3 w-3" />
                    {account.name || 'Account'}
                  </span>
                  <span className="text-sm font-medium">
                    {formatCurrency(account.balance, account.currency)}
                  </span>
                </div>
              ))}
              {accounts.length > 4 && (
                <Link
                  href="/finance/accounts"
                  className="text-xs text-primary hover:underline"
                >
                  View all {accounts.length} accounts
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Link to full view */}
        <div className="pt-2">
          <Link
            href="/finance/transactions"
            className="text-sm text-primary hover:underline"
          >
            View transactions →
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Compact version for sidebar or smaller spaces
 */
export function RevolutBalanceCardCompact({ balances, isConnected }: {
  balances: Record<string, number>
  isConnected: boolean
}) {
  if (!isConnected) {
    return null
  }

  const primaryCurrency = 'EUR'
  const primaryBalance = balances[primaryCurrency] || 0

  return (
    <div className="p-4 bg-surface rounded-lg border border-surface-border">
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-secondary flex items-center gap-2">
          <Wallet className="h-4 w-4" />
          Bank
        </span>
        <span className="text-sm font-semibold">
          {formatCurrency(primaryBalance, primaryCurrency)}
        </span>
      </div>
    </div>
  )
}
