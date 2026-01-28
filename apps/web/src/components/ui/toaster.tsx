'use client'

import { useEffect, useState } from 'react'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

export type ToastVariant = 'default' | 'success' | 'warning' | 'destructive' | 'info'

export interface Toast {
  id: string
  title: string
  description?: string
  variant?: ToastVariant
  duration?: number
}

// ============================================================================
// Toast Store (simple pub/sub)
// ============================================================================

type ToastListener = (toasts: Toast[]) => void

const listeners: Set<ToastListener> = new Set()
let toasts: Toast[] = []
let toastId = 0

function notify() {
  listeners.forEach((listener) => listener([...toasts]))
}

export function toast(options: Omit<Toast, 'id'>) {
  const id = String(++toastId)
  const duration = options.duration ?? 5000

  toasts = [...toasts, { ...options, id }]
  notify()

  // Auto dismiss
  if (duration > 0) {
    setTimeout(() => {
      dismissToast(id)
    }, duration)
  }

  return id
}

export function dismissToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id)
  notify()
}

function useToastStore() {
  const [state, setState] = useState<Toast[]>([])

  useEffect(() => {
    listeners.add(setState)
    return () => {
      listeners.delete(setState)
    }
  }, [])

  return state
}

// ============================================================================
// Toast Component
// ============================================================================

const variantStyles: Record<ToastVariant, string> = {
  default: 'bg-background-elevated border-border text-text-primary',
  success: 'bg-success-muted border-success/30 text-success',
  warning: 'bg-warning-muted border-warning/30 text-warning',
  destructive: 'bg-danger-muted border-danger/30 text-danger',
  info: 'bg-info-muted border-info/30 text-info',
}

const variantIcons: Record<ToastVariant, typeof CheckCircle> = {
  default: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  destructive: AlertCircle,
  info: Info,
}

function ToastItem({ toast: t }: { toast: Toast }) {
  const variant = t.variant || 'default'
  const Icon = variantIcons[variant]

  return (
    <div
      className={cn(
        'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border p-4 shadow-lg transition-all',
        variantStyles[variant]
      )}
      role="alert"
    >
      <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium">{t.title}</p>
        {t.description && (
          <p className="text-sm opacity-80">{t.description}</p>
        )}
      </div>
      <button
        onClick={() => dismissToast(t.id)}
        className="flex-shrink-0 rounded p-1 hover:bg-black/10 transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

// ============================================================================
// Toaster Component
// ============================================================================

export function Toaster() {
  const toastList = useToastStore()

  if (toastList.length === 0) {
    return null
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toastList.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  )
}

// ============================================================================
// useToast Hook (compatible with existing usage)
// ============================================================================

export function useToast() {
  return {
    toast: (options: Omit<Toast, 'id'>) => toast(options),
    dismiss: dismissToast,
  }
}
