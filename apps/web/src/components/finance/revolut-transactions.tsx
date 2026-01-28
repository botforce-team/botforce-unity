'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  Building2,
  RefreshCw,
  Search,
  Filter,
  Check,
  X,
  Link as LinkIcon,
} from 'lucide-react'
import type { RevolutTransactionInfo } from '@/app/actions/revolut'

interface RevolutTransactionsProps {
  transactions: RevolutTransactionInfo[]
  total: number
  onLoadMore?: () => void
  isLoading?: boolean
}

export function RevolutTransactions({
  transactions,
  total,
  onLoadMore,
  isLoading,
}: RevolutTransactionsProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const getTransactionIcon = (type: string, amount: number) => {
    if (type === 'card_payment') {
      return <CreditCard className="h-4 w-4" />
    }
    if (type === 'transfer' || type === 'bank_transfer') {
      return amount < 0 ? (
        <ArrowUpRight className="h-4 w-4 text-danger" />
      ) : (
        <ArrowDownLeft className="h-4 w-4 text-success" />
      )
    }
    if (type === 'fee') {
      return <Building2 className="h-4 w-4 text-text-muted" />
    }
    return amount < 0 ? (
      <ArrowUpRight className="h-4 w-4" />
    ) : (
      <ArrowDownLeft className="h-4 w-4" />
    )
  }

  const getStatusBadge = (state: string) => {
    switch (state) {
      case 'completed':
        return <Badge variant="success">Completed</Badge>
      case 'pending':
        return <Badge variant="warning">Pending</Badge>
      case 'declined':
        return <Badge variant="danger">Declined</Badge>
      case 'reverted':
        return <Badge variant="secondary">Reverted</Badge>
      case 'failed':
        return <Badge variant="danger">Failed</Badge>
      default:
        return <Badge>{state}</Badge>
    }
  }

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      card_payment: 'Card Payment',
      transfer: 'Transfer',
      bank_transfer: 'Bank Transfer',
      fee: 'Fee',
      exchange: 'Exchange',
      atm: 'ATM',
      refund: 'Refund',
      topup: 'Top Up',
    }
    return labels[type] || type
  }

  const filteredTransactions = searchQuery
    ? transactions.filter(
        (tx) =>
          tx.counterparty_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tx.merchant_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tx.reference?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tx.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : transactions

  if (transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-text-secondary">
            <RefreshCw className="h-8 w-8 mx-auto mb-3 text-text-muted" />
            <p>No transactions synced yet</p>
            <p className="text-sm mt-1">
              Sync your Revolut account to see transactions
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-medium">
          Recent Transactions
          <span className="text-text-muted font-normal ml-2">({total})</span>
        </CardTitle>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-text-muted" />
            <Input
              type="search"
              placeholder="Search..."
              className="pl-8 h-9 w-48"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-surface-border">
          {filteredTransactions.map((tx) => (
            <div
              key={tx.id}
              className="py-3 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`p-2 rounded-lg ${
                  tx.amount < 0 ? 'bg-danger-muted' : 'bg-success-muted'
                }`}>
                  {getTransactionIcon(tx.type, tx.amount)}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">
                    {tx.counterparty_name || tx.merchant_name || tx.description || getTypeLabel(tx.type)}
                  </div>
                  <div className="text-xs text-text-muted flex items-center gap-2">
                    <span>{formatDate(tx.transaction_date)}</span>
                    <span>·</span>
                    <span>{getTypeLabel(tx.type)}</span>
                    {tx.is_reconciled && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-1 text-success">
                          <Check className="h-3 w-3" />
                          Reconciled
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className={`font-semibold ${
                  tx.amount < 0 ? 'text-danger' : 'text-success'
                }`}>
                  {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount, tx.currency)}
                </div>
                <div className="text-xs">
                  {getStatusBadge(tx.state)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {onLoadMore && transactions.length < total && (
          <div className="pt-4 text-center">
            <Button
              variant="outline"
              onClick={onLoadMore}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                `Load More (${total - transactions.length} remaining)`
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Compact transaction row for use in other contexts
 */
export function RevolutTransactionRow({ transaction }: { transaction: RevolutTransactionInfo }) {
  const tx = transaction

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2 min-w-0">
        <div className={`w-2 h-2 rounded-full ${
          tx.amount < 0 ? 'bg-danger' : 'bg-success'
        }`} />
        <span className="text-sm truncate">
          {tx.counterparty_name || tx.merchant_name || tx.description || tx.type}
        </span>
      </div>
      <span className={`text-sm font-medium ${
        tx.amount < 0 ? 'text-danger' : 'text-success'
      }`}>
        {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount, tx.currency)}
      </span>
    </div>
  )
}
