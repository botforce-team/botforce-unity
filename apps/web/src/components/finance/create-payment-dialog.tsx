'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Send, X, Building2, CreditCard, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'

interface RevolutAccount {
  id: string
  name: string | null
  balance: number
  currency: string
  iban?: string | null
}

interface CreatePaymentDialogProps {
  accounts: RevolutAccount[]
  onClose: () => void
}

export function CreatePaymentDialog({ accounts, onClose }: CreatePaymentDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    sourceAccountId: '',
    recipientName: '',
    recipientIban: '',
    recipientBic: '',
    amount: '',
    currency: 'EUR',
    reference: '',
  })

  const selectedAccount = accounts.find(a => a.id === formData.sourceAccountId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch('/api/revolut/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceAccountId: formData.sourceAccountId,
          recipient: {
            name: formData.recipientName,
            iban: formData.recipientIban,
            bic: formData.recipientBic || undefined,
          },
          amount: parseFloat(formData.amount),
          currency: formData.currency,
          reference: formData.reference,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create payment')
      }

      toast({
        title: 'Payment initiated',
        description: `Payment of ${formData.amount} ${formData.currency} to ${formData.recipientName} has been initiated.`,
      })

      onClose()
      router.refresh()
    } catch (error) {
      toast({
        title: 'Payment failed',
        description: error instanceof Error ? error.message : 'Failed to create payment',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const formatBalance = (balance: number, currency: string) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency,
    }).format(balance / 100)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-lg mx-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Create Payment
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Source Account */}
            <div className="space-y-2">
              <Label htmlFor="sourceAccount">From Account</Label>
              <Select
                id="sourceAccount"
                value={formData.sourceAccountId}
                onChange={(e) => setFormData({ ...formData, sourceAccountId: e.target.value })}
                required
              >
                <option value="">Select account</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name || 'Unnamed Account'} ({formatBalance(account.balance, account.currency)})
                  </option>
                ))}
              </Select>
              {selectedAccount?.iban && (
                <p className="text-xs text-text-muted">IBAN: {selectedAccount.iban}</p>
              )}
            </div>

            {/* Recipient Details */}
            <div className="space-y-4 rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Building2 className="h-4 w-4" />
                Recipient Details
              </div>

              <div className="space-y-2">
                <Label htmlFor="recipientName">Recipient Name</Label>
                <Input
                  id="recipientName"
                  value={formData.recipientName}
                  onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })}
                  placeholder="Company or person name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="recipientIban">IBAN</Label>
                <Input
                  id="recipientIban"
                  value={formData.recipientIban}
                  onChange={(e) => setFormData({ ...formData, recipientIban: e.target.value.toUpperCase().replace(/\s/g, '') })}
                  placeholder="DE89370400440532013000"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="recipientBic">BIC/SWIFT (optional)</Label>
                <Input
                  id="recipientBic"
                  value={formData.recipientBic}
                  onChange={(e) => setFormData({ ...formData, recipientBic: e.target.value.toUpperCase() })}
                  placeholder="COBADEFFXXX"
                />
              </div>
            </div>

            {/* Amount */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select
                  id="currency"
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                >
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                  <option value="CHF">CHF</option>
                </Select>
              </div>
            </div>

            {/* Reference */}
            <div className="space-y-2">
              <Label htmlFor="reference">Payment Reference</Label>
              <Input
                id="reference"
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                placeholder="Invoice #12345"
                maxLength={140}
                required
              />
              <p className="text-xs text-text-muted">
                {formData.reference.length}/140 characters
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading || !formData.sourceAccountId || !formData.amount}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Payment
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
