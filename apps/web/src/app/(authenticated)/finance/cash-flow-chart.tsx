'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, ComposedChart, Line, Legend } from 'recharts'
import type { ForecastDataPoint } from '@/app/actions/finance'
import { formatCurrency } from '@/lib/utils'

interface CashFlowChartProps {
  data: ForecastDataPoint[]
}

export function CashFlowChart({ data }: CashFlowChartProps) {
  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload as ForecastDataPoint
      return (
        <div
          className="p-3 rounded-[10px] text-[12px]"
          style={{
            background: 'rgba(20, 20, 30, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          }}
        >
          <p className="font-semibold text-white mb-2">{point.week}</p>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[#22c55e]">Expected Inflow:</span>
              <span className="text-white font-medium">{formatCurrency(point.expectedInflow)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-[#ef4444]">Expected Outflow:</span>
              <span className="text-white font-medium">{formatCurrency(point.expectedOutflow)}</span>
            </div>
            <div className="pt-1 mt-1 border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[#1f5bff]">Cumulative Balance:</span>
                <span className={`font-medium ${point.cumulativeBalance >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                  {formatCurrency(point.cumulativeBalance)}
                </span>
              </div>
            </div>
            {point.invoicesDue > 0 && (
              <p className="text-[rgba(232,236,255,0.5)] mt-1">
                {point.invoicesDue} invoice{point.invoicesDue !== 1 ? 's' : ''} due
              </p>
            )}
          </div>
        </div>
      )
    }
    return null
  }

  // Format Y axis values
  const formatYAxis = (value: number) => {
    if (Math.abs(value) >= 1000) {
      return `€${(value / 1000).toFixed(0)}k`
    }
    return `€${value}`
  }

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorInflow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorOutflow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#1f5bff" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#1f5bff" stopOpacity={0.05} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="rgba(255, 255, 255, 0.06)"
          />

          <XAxis
            dataKey="week"
            tick={{ fill: 'rgba(232, 236, 255, 0.5)', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(255, 255, 255, 0.08)' }}
          />

          <YAxis
            tickFormatter={formatYAxis}
            tick={{ fill: 'rgba(232, 236, 255, 0.5)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={60}
          />

          <Tooltip content={<CustomTooltip />} />

          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            formatter={(value: string) => (
              <span style={{ color: 'rgba(232, 236, 255, 0.7)', fontSize: '11px' }}>
                {value}
              </span>
            )}
          />

          <Bar
            dataKey="expectedInflow"
            name="Expected Inflow"
            fill="#22c55e"
            fillOpacity={0.6}
            radius={[4, 4, 0, 0]}
          />

          <Bar
            dataKey="expectedOutflow"
            name="Expected Outflow"
            fill="#ef4444"
            fillOpacity={0.6}
            radius={[4, 4, 0, 0]}
          />

          <Line
            type="monotone"
            dataKey="cumulativeBalance"
            name="Cumulative Balance"
            stroke="#1f5bff"
            strokeWidth={3}
            dot={{ fill: '#1f5bff', r: 4 }}
            activeDot={{ r: 6, fill: '#1f5bff', stroke: '#fff', strokeWidth: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// Simple bar chart for AR aging
export function ARAgingChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ fill: 'rgba(232, 236, 255, 0.5)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={100}
          />
          <Bar
            dataKey="value"
            radius={[0, 4, 4, 0]}
            fill="#1f5bff"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
