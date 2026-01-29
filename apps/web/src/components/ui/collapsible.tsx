'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CollapsibleContextValue {
  isOpen: boolean
  toggle: () => void
}

const CollapsibleContext = createContext<CollapsibleContextValue | null>(null)

function useCollapsible() {
  const context = useContext(CollapsibleContext)
  if (!context) {
    throw new Error('useCollapsible must be used within a Collapsible')
  }
  return context
}

interface CollapsibleProps {
  children: ReactNode
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
}

function Collapsible({
  children,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  className,
}: CollapsibleProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)

  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : internalOpen

  const toggle = () => {
    const newValue = !isOpen
    if (!isControlled) {
      setInternalOpen(newValue)
    }
    onOpenChange?.(newValue)
  }

  return (
    <CollapsibleContext.Provider value={{ isOpen, toggle }}>
      <div className={className}>{children}</div>
    </CollapsibleContext.Provider>
  )
}

interface CollapsibleTriggerProps {
  children: ReactNode
  className?: string
  showIcon?: boolean
  iconPosition?: 'left' | 'right'
}

function CollapsibleTrigger({
  children,
  className,
  showIcon = true,
  iconPosition = 'left',
}: CollapsibleTriggerProps) {
  const { isOpen, toggle } = useCollapsible()

  const Icon = isOpen ? ChevronDown : ChevronRight

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        'flex w-full items-center gap-2 text-left transition-colors hover:bg-surface-hover rounded-md',
        className
      )}
      aria-expanded={isOpen}
    >
      {showIcon && iconPosition === 'left' && (
        <Icon className="h-4 w-4 shrink-0 text-text-muted transition-transform" />
      )}
      <span className="flex-1">{children}</span>
      {showIcon && iconPosition === 'right' && (
        <Icon className="h-4 w-4 shrink-0 text-text-muted transition-transform" />
      )}
    </button>
  )
}

interface CollapsibleContentProps {
  children: ReactNode
  className?: string
}

function CollapsibleContent({ children, className }: CollapsibleContentProps) {
  const { isOpen } = useCollapsible()

  if (!isOpen) return null

  return (
    <div
      className={cn(
        'overflow-hidden transition-all duration-200 ease-in-out',
        className
      )}
    >
      {children}
    </div>
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent, useCollapsible }
