'use client'

import { useState, useEffect } from 'react'
import { Send, CheckCircle, Clock, XCircle, AlertCircle, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'

interface Payment {
  id: string
  revolut_payment_id: string
  recipient_name: string
  recipient_iban: string
  amount: number
  currency: string
  reference: string
  status: string
  created_at: string
  completed_at?: string
  reason_code?: string
  error_message?: string
}

interface PaymentsListProps {
  initialPayments?: Payment[]
  isConnected: boolean
}

const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  pending: {
    icon: <Clock className="h-4 w-4" />,
    color: 'bg-warning/10 text-warning',
    label: 'Pending',
  },
  completed: {
    icon: <CheckCircle className="h-4 w-4" />,
    color: 'bg-success/10 text-success',
    label: 'Completed',
  },
  failed: {
    icon: <XCircle className="h-4 w-4" />,
    color: 'bg-danger/10 text-danger',
    label: 'Failed',
  },
  cancelled: {
    icon: <AlertCircle className="h-4 w-4" />,
    color: 'bg-text-muted/10 text-text-muted',
    label: 'Cancelled',
  },
}

export function PaymentsList({ initialPayments = [], isConnected }: PaymentsListProps) {
  const [payments, setPayments] = useState<Payment[]>(initialPayments)
  const [isLoading, setIsLoading] = useState(false)

  const fetchPayments = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/revolut/payments?limit=10')
      if (response.ok) {
        const data = await response.json()
        setPayments(data.payments || [])
      }
    } catch (error) {
      console.error('Failed to fetch payments:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isConnected && initialPayments.length === 0) {
      fetchPayments()
    }
  }, [isConnected])

  if (!isConnected) {
    return null
  }

  if (payments.length === 0 && !isLoading) {
    return null
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          Recent Payments
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchPayments}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading && payments.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-text-muted" />
          </div>
        ) : (
          <div className="space-y-3">
            {payments.map((payment) => {
              const status = statusConfig[payment.status] || statusConfig.pending
              return (
                <div
                  key={payment.id}
                  className="flex items-center justify-between py-3 border-b border-border last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${status.color}`}>
                      {status.icon}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        {payment.recipient_name}
                      </p>
                      <p className="text-xs text-text-muted">
                        {payment.reference} &bull; {formatDate(payment.created_at)}
                      </p>
                      {(payment.reason_code || payment.error_message) && (
                        <p className="text-xs text-danger mt-1">
                          {payment.error_message || payment.reason_code}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-text-primary">
                      {formatCurrency(payment.amount / 100, payment.currency)}
                    </p>
                    <Badge variant="secondary" className={`text-xs ${status.color}`}>
                      {status.label}
                    </Badge>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
