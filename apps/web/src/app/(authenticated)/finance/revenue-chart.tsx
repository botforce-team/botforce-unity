'use client'

import { formatCurrency } from '@/lib/utils'

interface MonthlyData {
  month: string
  revenue: number
  outstanding: number
  expenses: number
}

interface RevenueChartProps {
  data: MonthlyData[]
}

const BAR_HEIGHT = 185

export function RevenueChart({ data }: RevenueChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-text-muted">
        No data available
      </div>
    )
  }

  // Check if all values are zero
  const hasData = data.some((d) => d.revenue > 0 || d.outstanding > 0 || d.expenses > 0)

  if (!hasData) {
    return (
      <div className="flex h-[200px] items-center justify-center text-text-muted">
        No revenue or expense data in this period
      </div>
    )
  }

  // Find max value for scaling
  const maxValue = Math.max(
    ...data.map((d) => Math.max(d.revenue + d.outstanding, d.expenses)),
    1
  )

  // Convert value to pixels
  const toPx = (value: number) => {
    if (value <= 0) return 0
    return Math.max(Math.round((value / maxValue) * BAR_HEIGHT), 4)
  }

  // Generate y-axis labels
  const yAxisSteps = 4
  const yAxisLabels = Array.from({ length: yAxisSteps + 1 }, (_, i) => {
    const value = maxValue * (1 - i / yAxisSteps)
    if (value >= 1000) return `${Math.round(value / 1000)}k`
    return Math.round(value).toString()
  })

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
          <div className="h-3 w-3 rounded-sm bg-success" />
          <span className="text-text-secondary">Paid</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-sm bg-warning/70" />
          <span className="text-text-secondary">Outstanding</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-sm bg-danger/70" />
          <span className="text-text-secondary">Expenses</span>
        </div>
      </div>

      {/* Chart */}
      <div className="h-[220px] flex">
        {/* Y-axis labels */}
        <div className="flex flex-col justify-between pr-2 text-right w-10 shrink-0">
          {yAxisLabels.map((label, i) => (
            <span key={i} className="text-[10px] text-text-muted leading-none">
              {label}
            </span>
          ))}
        </div>

        {/* Chart area */}
        <div className="flex-1 relative">
          {/* Grid lines */}
          {yAxisLabels.map((_, i) => (
            <div
              key={i}
              className="absolute left-0 right-0 border-t border-border/40"
              style={{ top: `${(i / yAxisSteps) * 100}%` }}
            />
          ))}

          <div className="flex h-full items-end gap-2 relative z-10">
            {data.map((item) => {
              const revenuePx = toPx(item.revenue)
              const outstandingPx = toPx(item.outstanding)
              const expensePx = toPx(item.expenses)

              return (
                <div key={item.month} className="flex-1 flex flex-col items-center gap-1">
                  {/* Bars */}
                  <div
                    className="flex items-end gap-0.5 w-full justify-center"
                    style={{ height: `${BAR_HEIGHT}px` }}
                  >
                    {/* Revenue + Outstanding stacked bar */}
                    <div className="relative group flex-1 max-w-[20px] flex flex-col justify-end">
                      {item.outstanding > 0 && (
                        <div
                          className="w-full bg-warning/70 transition-all hover:bg-warning/60"
                          style={{ height: `${outstandingPx}px` }}
                        />
                      )}
                      {item.revenue > 0 && (
                        <div
                          className={`w-full bg-success transition-all hover:bg-success/80 ${
                            item.outstanding <= 0 ? 'rounded-t-sm' : ''
                          }`}
                          style={{ height: `${revenuePx}px` }}
                        />
                      )}
                      {item.outstanding > 0 && !item.revenue && (
                        <div className="w-full rounded-t-sm" />
                      )}
                      {/* Round top of topmost bar */}
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20">
                        <div className="rounded bg-background-secondary border border-border px-2 py-1.5 text-xs whitespace-nowrap shadow-lg space-y-0.5">
                          {item.revenue > 0 && (
                            <p className="text-success font-medium">{formatCurrency(item.revenue)} paid</p>
                          )}
                          {item.outstanding > 0 && (
                            <p className="text-warning font-medium">{formatCurrency(item.outstanding)} outstanding</p>
                          )}
                          {item.revenue === 0 && item.outstanding === 0 && (
                            <p className="text-text-muted">No revenue</p>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Expense bar */}
                    <div className="relative group flex-1 max-w-[20px] flex flex-col justify-end">
                      {item.expenses > 0 && (
                        <div
                          className="w-full rounded-t-sm bg-danger/70 transition-all hover:bg-danger/60"
                          style={{ height: `${expensePx}px` }}
                        />
                      )}
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20">
                        <div className="rounded bg-background-secondary border border-border px-2 py-1 text-xs whitespace-nowrap shadow-lg">
                          <p className="text-danger font-medium">{formatCurrency(item.expenses)}</p>
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
      </div>

      {/* Summary */}
      <div className="flex justify-between pt-2 border-t border-border text-sm">
        <div>
          <span className="text-text-secondary">Revenue: </span>
          <span className="font-medium text-success">
            {formatCurrency(data.reduce((sum, d) => sum + d.revenue, 0))}
          </span>
          {data.some((d) => d.outstanding > 0) && (
            <span className="text-warning ml-2">
              +{formatCurrency(data.reduce((sum, d) => sum + d.outstanding, 0))} outstanding
            </span>
          )}
        </div>
        <div>
          <span className="text-text-secondary">Expenses: </span>
          <span className="font-medium text-danger">
            {formatCurrency(data.reduce((sum, d) => sum + d.expenses, 0))}
          </span>
        </div>
      </div>
    </div>
  )
}
