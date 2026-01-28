// Simple toast hook implementation
// For production, consider using a library like sonner or react-hot-toast

type ToastVariant = 'default' | 'destructive'

interface ToastOptions {
  title: string
  description?: string
  variant?: ToastVariant
}

export function useToast() {
  const toast = (options: ToastOptions) => {
    // Simple implementation using native notifications or console
    const message = options.description
      ? `${options.title}: ${options.description}`
      : options.title

    if (options.variant === 'destructive') {
      console.error('[Toast Error]', message)
      // Using alert for destructive messages to ensure visibility
      alert(message)
    } else {
      console.log('[Toast]', message)
      // For success messages, we could use a notification API
      // For now, we'll log to console
    }
  }

  return { toast }
}
