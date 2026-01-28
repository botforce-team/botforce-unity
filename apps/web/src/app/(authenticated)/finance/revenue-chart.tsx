'use client'

import { formatCurrency } from '@/lib/utils'

interface MonthlyData {
  month: string
  revenue: number
  expenses: number
}

interface RevenueChartProps {
  data: MonthlyData[]
}

export function RevenueChart({ data }: RevenueChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-text-muted">
        No data available
      </div>
    )
  }

  // Find max value for scaling
  const maxValue = Math.max(
    ...data.map((d) => Math.max(d.revenue, d.expenses)),
    1
  )

  // Format month labels
  const formatMonth = (month: string) => {
    const [year, m] = month.split('-')
    const date = new Date(parseInt(year), parseInt(m) - 1)
    return date.toLocaleDateString('en-US', { month: 'short' })
  }

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex items-center justify-end gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-sm bg-primary" />
          <span className="text-text-secondary">Revenue</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-sm bg-danger/70" />
          <span className="text-text-secondary">Expenses</span>
        </div>
      </div>

      {/* Chart */}
      <div className="h-[200px]">
        <div className="flex h-full items-end gap-2">
          {data.map((item, index) => {
            const revenueHeight = (item.revenue / maxValue) * 100
            const expenseHeight = (item.expenses / maxValue) * 100

            return (
              <div key={item.month} className="flex-1 flex flex-col items-center gap-1">
                {/* Bars container */}
                <div className="flex h-[160px] items-end gap-1 w-full justify-center">
                  {/* Revenue bar */}
                  <div className="relative group flex-1 max-w-[20px]">
                    <div
                      className="w-full rounded-t-sm bg-primary transition-all hover:bg-primary/80"
                      style={{ height: `${Math.max(revenueHeight, 2)}%` }}
                    />
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                      <div className="rounded bg-background-secondary border border-border px-2 py-1 text-xs whitespace-nowrap shadow-lg">
                        <p className="text-text-primary font-medium">{formatCurrency(item.revenue)}</p>
                        <p className="text-text-muted">Revenue</p>
                      </div>
                    </div>
                  </div>
                  {/* Expense bar */}
                  <div className="relative group flex-1 max-w-[20px]">
                    <div
                      className="w-full rounded-t-sm bg-danger/70 transition-all hover:bg-danger/60"
                      style={{ height: `${Math.max(expenseHeight, 2)}%` }}
                    />
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                      <div className="rounded bg-background-secondary border border-border px-2 py-1 text-xs whitespace-nowrap shadow-lg">
                        <p className="text-text-primary font-medium">{formatCurrency(item.expenses)}</p>
                        <p className="text-text-muted">Expenses</p>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Month label */}
                <span className="text-xs text-text-muted">{formatMonth(item.month)}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Summary */}
      <div className="flex justify-between pt-2 border-t border-border text-sm">
        <div>
          <span className="text-text-secondary">Total Revenue: </span>
          <span className="font-medium text-success">
            {formatCurrency(data.reduce((sum, d) => sum + d.revenue, 0))}
          </span>
        </div>
        <div>
          <span className="text-text-secondary">Total Expenses: </span>
          <span className="font-medium text-danger">
            {formatCurrency(data.reduce((sum, d) => sum + d.expenses, 0))}
          </span>
        </div>
      </div>
    </div>
  )
}
