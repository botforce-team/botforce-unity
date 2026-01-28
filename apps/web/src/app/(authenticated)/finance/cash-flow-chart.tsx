'use client'

import { formatCurrency } from '@/lib/utils'
import type { CashForecastWeek } from '@/app/actions/finance'

interface CashFlowChartProps {
  data: CashForecastWeek[]
}

export function CashFlowChart({ data }: CashFlowChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-text-muted">
        No forecast data available
      </div>
    )
  }

  // Find min/max for scaling (including negatives)
  const allBalances = data.map(d => d.cumulativeBalance)
  const maxBalance = Math.max(...allBalances, 0)
  const minBalance = Math.min(...allBalances, 0)
  const range = maxBalance - minBalance || 1

  // Calculate zero line position
  const zeroLinePosition = (maxBalance / range) * 100

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex items-center justify-end gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-sm bg-success" />
          <span className="text-text-secondary">Income</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-sm bg-danger/70" />
          <span className="text-text-secondary">Expenses</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1 w-6 bg-primary" />
          <span className="text-text-secondary">Balance</span>
        </div>
      </div>

      {/* Chart */}
      <div className="h-[250px] relative">
        {/* Zero line */}
        <div
          className="absolute left-0 right-0 border-t border-border"
          style={{ top: `${zeroLinePosition}%` }}
        >
          <span className="absolute -left-1 -top-3 text-[10px] text-text-muted">0</span>
        </div>

        <div className="flex h-full items-end gap-1 pt-6 pb-8 relative">
          {/* Balance line chart overlay */}
          <svg
            className="absolute inset-0 pointer-events-none"
            style={{ top: '24px', bottom: '32px', height: 'calc(100% - 56px)' }}
          >
            <polyline
              fill="none"
              stroke="#2563eb"
              strokeWidth="2"
              points={data.map((item, index) => {
                const x = (index / (data.length - 1)) * 100
                const y = 100 - ((item.cumulativeBalance - minBalance) / range) * 100
                return `${x}%,${y}%`
              }).join(' ')}
            />
            {/* Points */}
            {data.map((item, index) => {
              const x = (index / (data.length - 1)) * 100
              const y = 100 - ((item.cumulativeBalance - minBalance) / range) * 100
              return (
                <circle
                  key={index}
                  cx={`${x}%`}
                  cy={`${y}%`}
                  r="4"
                  fill={item.cumulativeBalance >= 0 ? '#10b981' : '#ef4444'}
                  stroke="white"
                  strokeWidth="1"
                />
              )
            })}
          </svg>

          {data.map((item, index) => {
            const incomeHeight = Math.abs(item.expectedIncome / range) * 100
            const expenseHeight = Math.abs(item.expectedExpenses / range) * 100

            return (
              <div key={item.weekStart} className="flex-1 flex flex-col items-center gap-1">
                {/* Bars container */}
                <div className="flex h-[180px] items-end gap-0.5 w-full justify-center relative">
                  {/* Income bar */}
                  <div className="relative group flex-1 max-w-[12px]">
                    <div
                      className="w-full rounded-t-sm bg-success/80 transition-all hover:bg-success"
                      style={{ height: `${Math.max(incomeHeight, 1)}%` }}
                    />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                      <div className="rounded bg-background-secondary border border-border px-2 py-1 text-xs whitespace-nowrap shadow-lg">
                        <p className="text-success font-medium">+{formatCurrency(item.expectedIncome)}</p>
                        <p className="text-text-muted">Expected Income</p>
                      </div>
                    </div>
                  </div>
                  {/* Expense bar */}
                  <div className="relative group flex-1 max-w-[12px]">
                    <div
                      className="w-full rounded-t-sm bg-danger/60 transition-all hover:bg-danger/80"
                      style={{ height: `${Math.max(expenseHeight, 1)}%` }}
                    />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                      <div className="rounded bg-background-secondary border border-border px-2 py-1 text-xs whitespace-nowrap shadow-lg">
                        <p className="text-danger font-medium">-{formatCurrency(item.expectedExpenses)}</p>
                        <p className="text-text-muted">Expected Expenses</p>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Week label */}
                <span className="text-[10px] text-text-muted truncate max-w-full">
                  {item.weekLabel.split(' ')[0]}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Forecast summary table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-text-muted">
              <th className="text-left py-2 font-medium">Week</th>
              <th className="text-right py-2 font-medium">Income</th>
              <th className="text-right py-2 font-medium">Expenses</th>
              <th className="text-right py-2 font-medium">Net</th>
              <th className="text-right py-2 font-medium">Balance</th>
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 6).map((week) => (
              <tr key={week.weekStart} className="border-b border-border/50">
                <td className="py-1.5 text-text-secondary">{week.weekLabel}</td>
                <td className="py-1.5 text-right text-success">
                  {week.expectedIncome > 0 ? `+${formatCurrency(week.expectedIncome)}` : '-'}
                </td>
                <td className="py-1.5 text-right text-danger">
                  -{formatCurrency(week.expectedExpenses)}
                </td>
                <td className={`py-1.5 text-right font-medium ${week.netCashFlow >= 0 ? 'text-success' : 'text-danger'}`}>
                  {week.netCashFlow >= 0 ? '+' : ''}{formatCurrency(week.netCashFlow)}
                </td>
                <td className={`py-1.5 text-right font-medium ${week.cumulativeBalance >= 0 ? 'text-text-primary' : 'text-danger'}`}>
                  {formatCurrency(week.cumulativeBalance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 12-week summary */}
      <div className="flex justify-between pt-2 border-t border-border text-sm">
        <div>
          <span className="text-text-secondary">12-Week Projected Income: </span>
          <span className="font-medium text-success">
            {formatCurrency(data.reduce((sum, d) => sum + d.expectedIncome, 0))}
          </span>
        </div>
        <div>
          <span className="text-text-secondary">Final Balance: </span>
          <span className={`font-medium ${data[data.length - 1]?.cumulativeBalance >= 0 ? 'text-success' : 'text-danger'}`}>
            {formatCurrency(data[data.length - 1]?.cumulativeBalance || 0)}
          </span>
        </div>
      </div>
    </div>
  )
}
