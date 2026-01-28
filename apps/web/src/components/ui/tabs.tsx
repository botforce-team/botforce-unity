'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface TabsContextType {
  value: string
  onChange: (value: string) => void
}

const TabsContext = createContext<TabsContextType | null>(null)

function useTabs() {
  const context = useContext(TabsContext)
  if (!context) {
    throw new Error('Tabs components must be used within a Tabs provider')
  }
  return context
}

interface TabsProps {
  defaultValue: string
  children: ReactNode
  className?: string
}

export function Tabs({ defaultValue, children, className }: TabsProps) {
  const [value, setValue] = useState(defaultValue)

  return (
    <TabsContext.Provider value={{ value, onChange: setValue }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

interface TabsListProps {
  children: ReactNode
  className?: string
}

export function TabsList({ children, className }: TabsListProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center justify-center rounded-lg bg-surface p-1',
        className
      )}
    >
      {children}
    </div>
  )
}

interface TabsTriggerProps {
  value: string
  children: ReactNode
  className?: string
}

export function TabsTrigger({ value, children, className }: TabsTriggerProps) {
  const { value: selectedValue, onChange } = useTabs()
  const isActive = selectedValue === value

  return (
    <button
      onClick={() => onChange(value)}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all',
        isActive
          ? 'bg-background text-text-primary shadow-sm'
          : 'text-text-secondary hover:text-text-primary',
        className
      )}
    >
      {children}
    </button>
  )
}

interface TabsContentProps {
  value: string
  children: ReactNode
  className?: string
}

export function TabsContent({ value, children, className }: TabsContentProps) {
  const { value: selectedValue } = useTabs()

  if (selectedValue !== value) {
    return null
  }

  return <div className={className}>{children}</div>
}
