'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MoreHorizontal, Pencil, Trash2, Eye, Power, PowerOff } from 'lucide-react'
import { Button } from '@/components/ui'
import { deleteCustomer, toggleCustomerActive } from '@/app/actions/customers'
import type { Customer } from '@/types'

interface CustomerActionsProps {
  customer: Customer
}

export function CustomerActions({ customer }: CustomerActionsProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleToggleActive = () => {
    startTransition(async () => {
      const result = await toggleCustomerActive(customer.id, !customer.is_active)
      if (!result.success) {
        alert(result.error)
      }
      setIsOpen(false)
    })
  }

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteCustomer(customer.id)
      if (!result.success) {
        alert(result.error)
      }
      setShowDeleteConfirm(false)
      setIsOpen(false)
    })
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isPending}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setIsOpen(false)
              setShowDeleteConfirm(false)
            }}
          />
          <div className="absolute right-0 bottom-full z-50 mb-1 w-48 rounded-md border border-border bg-surface shadow-lg max-h-80 overflow-y-auto">
            {showDeleteConfirm ? (
              <div className="p-3">
                <p className="text-sm text-text-primary mb-3">Delete this customer?</p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleDelete}
                    disabled={isPending}
                  >
                    {isPending ? 'Deleting...' : 'Delete'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="py-1">
                <Link
                  href={`/customers/${customer.id}`}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-hover"
                  onClick={() => setIsOpen(false)}
                >
                  <Eye className="h-4 w-4" />
                  View Details
                </Link>
                <Link
                  href={`/customers/${customer.id}/edit`}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-hover"
                  onClick={() => setIsOpen(false)}
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </Link>
                <button
                  onClick={handleToggleActive}
                  disabled={isPending}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-hover disabled:opacity-50"
                >
                  {customer.is_active ? (
                    <>
                      <PowerOff className="h-4 w-4" />
                      Deactivate
                    </>
                  ) : (
                    <>
                      <Power className="h-4 w-4" />
                      Activate
                    </>
                  )}
                </button>
                <hr className="my-1 border-border" />
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-surface-hover"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
