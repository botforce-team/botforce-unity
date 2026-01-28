import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-9 w-full rounded-md border bg-surface px-3 py-2 text-sm text-text-primary',
          'placeholder:text-text-muted',
          'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'transition-colors duration-150',
          error ? 'border-danger' : 'border-border',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }
