'use client'

import { useState } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CreatePaymentDialog } from './create-payment-dialog'

interface RevolutAccount {
  id: string
  name: string | null
  balance: number
  currency: string
  iban?: string | null
}

interface PaymentActionsProps {
  accounts: RevolutAccount[]
  isConnected: boolean
}

export function PaymentActions({ accounts, isConnected }: PaymentActionsProps) {
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)

  if (!isConnected || accounts.length === 0) {
    return null
  }

  return (
    <>
      <Button
        onClick={() => setShowPaymentDialog(true)}
        className="flex items-center gap-2"
      >
        <Send className="h-4 w-4" />
        New Payment
      </Button>

      {showPaymentDialog && (
        <CreatePaymentDialog
          accounts={accounts}
          onClose={() => setShowPaymentDialog(false)}
        />
      )}
    </>
  )
}
