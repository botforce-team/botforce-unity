import { forwardRef, type SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'

interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
  options?: SelectOption[]
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, options, children, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          className={cn(
            'flex h-9 w-full appearance-none rounded-md border bg-surface px-3 py-2 pr-8 text-sm text-text-primary',
            'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'transition-colors duration-150',
            error ? 'border-danger' : 'border-border',
            className
          )}
          ref={ref}
          {...props}
        >
          {options
            ? options.map((option) => (
                <option key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </option>
              ))
            : children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
      </div>
    )
  }
)
Select.displayName = 'Select'

export { Select }
