'use client'

import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, TrendingDown, DollarSign, Clock, AlertTriangle, ArrowUpRight, ArrowDownRight, Settings, RefreshCw } from 'lucide-react'
import { getFinancialSummary, type FinancialSummary, type RecurringCost } from '@/app/actions/finance'
import { formatCurrency } from '@/lib/utils'
import { CashFlowChart } from './cash-flow-chart'

const cardStyle = {
  background: 'rgba(255, 255, 255, 0.04)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
}

const inputStyle = {
  background: 'rgba(0, 0, 0, 0.25)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
}

interface SimulationParams {
  startingCashBalance: number
  recurringCosts: RecurringCost[]
  paymentDelayDays: number // Simulate customers paying late
  collectionRate: number // % of invoices expected to be paid
}

const defaultRecurringCosts: RecurringCost[] = [
  { id: '1', name: 'Office Rent', amount: 2000, frequency: 'monthly', dayOfMonth: 1 },
  { id: '2', name: 'Software Subscriptions', amount: 500, frequency: 'monthly', dayOfMonth: 15 },
  { id: '3', name: 'Insurance', amount: 300, frequency: 'monthly', dayOfMonth: 1 },
]

export function FinanceDashboard() {
  const [data, setData] = useState<FinancialSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showSimulation, setShowSimulation] = useState(false)

  const [params, setParams] = useState<SimulationParams>({
    startingCashBalance: 10000,
    recurringCosts: defaultRecurringCosts,
    paymentDelayDays: 0,
    collectionRate: 100,
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    const result = await getFinancialSummary(params.startingCashBalance, params.recurringCosts)
    if (result.error) {
      setError(result.error)
    } else if (result.data) {
      setData(result.data)
    }
    setLoading(false)
  }, [params.startingCashBalance, params.recurringCosts])

  useEffect(() => {
    loadData()
  }, [loadData])

  function updateRecurringCost(id: string, field: keyof RecurringCost, value: any) {
    setParams(prev => ({
      ...prev,
      recurringCosts: prev.recurringCosts.map(cost =>
        cost.id === id ? { ...cost, [field]: value } : cost
      ),
    }))
  }

  function addRecurringCost() {
    setParams(prev => ({
      ...prev,
      recurringCosts: [
        ...prev.recurringCosts,
        { id: Date.now().toString(), name: 'New Cost', amount: 0, frequency: 'monthly' as const, dayOfMonth: 1 },
      ],
    }))
  }

  function removeRecurringCost(id: string) {
    setParams(prev => ({
      ...prev,
      recurringCosts: prev.recurringCosts.filter(cost => cost.id !== id),
    }))
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-[rgba(232,236,255,0.6)]">Loading financial data...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-[#ef4444]">{error}</p>
      </div>
    )
  }

  if (!data) return null

  // Calculate key metrics
  const netPosition = data.accountsReceivable - data.accountsPayable
  const liquidityRatio = data.accountsPayable > 0 ? data.accountsReceivable / data.accountsPayable : data.accountsReceivable > 0 ? Infinity : 1
  const overduePercentage = data.accountsReceivable > 0 ? (data.overdueAR / data.accountsReceivable) * 100 : 0

  // Calculate projected cash at end of forecast
  const projectedCash = data.forecast.length > 0 ? data.forecast[data.forecast.length - 1].cumulativeBalance : params.startingCashBalance

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Cash Flow & Liquidity</h1>
          <p className="mt-1 text-[13px] text-[rgba(232,236,255,0.68)]">
            Financial overview with 12-week forecast
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSimulation(!showSimulation)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-[12px] text-[13px] font-medium ${
              showSimulation ? 'text-[#1f5bff]' : 'text-[rgba(232,236,255,0.8)]'
            }`}
            style={{
              background: showSimulation ? 'rgba(31, 91, 255, 0.15)' : 'rgba(255, 255, 255, 0.08)',
              border: showSimulation ? '1px solid rgba(31, 91, 255, 0.5)' : '1px solid rgba(255, 255, 255, 0.12)',
            }}
          >
            <Settings className="h-4 w-4" />
            Simulation
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[12px] text-[13px] font-medium text-[rgba(232,236,255,0.8)] disabled:opacity-50"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
            }}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Simulation Panel */}
      {showSimulation && (
        <div className="rounded-[18px] overflow-hidden" style={cardStyle}>
          <div className="p-5 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
            <h2 className="text-[15px] font-semibold text-white">Simulation Parameters</h2>
            <p className="text-[12px] text-[rgba(232,236,255,0.5)] mt-1">
              Adjust parameters to run "what-if" scenarios
            </p>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
                  Starting Cash Balance
                </label>
                <input
                  type="number"
                  value={params.startingCashBalance}
                  onChange={(e) => setParams(prev => ({ ...prev, startingCashBalance: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] focus:outline-none"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
                  Expected Collection Rate (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={params.collectionRate}
                  onChange={(e) => setParams(prev => ({ ...prev, collectionRate: parseFloat(e.target.value) || 100 }))}
                  className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] focus:outline-none"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Recurring Costs */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide">
                  Monthly Recurring Costs
                </label>
                <button
                  onClick={addRecurringCost}
                  className="text-[12px] text-[#1f5bff] hover:underline"
                >
                  + Add Cost
                </button>
              </div>
              <div className="space-y-2">
                {params.recurringCosts.map((cost) => (
                  <div key={cost.id} className="flex items-center gap-3 p-3 rounded-[10px]" style={{ background: 'rgba(0, 0, 0, 0.2)' }}>
                    <input
                      type="text"
                      value={cost.name}
                      onChange={(e) => updateRecurringCost(cost.id, 'name', e.target.value)}
                      placeholder="Name"
                      className="flex-1 px-2 py-1.5 rounded-[8px] text-[12px] text-[#e8ecff] focus:outline-none"
                      style={inputStyle}
                    />
                    <input
                      type="number"
                      value={cost.amount}
                      onChange={(e) => updateRecurringCost(cost.id, 'amount', parseFloat(e.target.value) || 0)}
                      placeholder="Amount"
                      className="w-24 px-2 py-1.5 rounded-[8px] text-[12px] text-[#e8ecff] focus:outline-none"
                      style={inputStyle}
                    />
                    <select
                      value={cost.frequency}
                      onChange={(e) => updateRecurringCost(cost.id, 'frequency', e.target.value)}
                      className="px-2 py-1.5 rounded-[8px] text-[12px] text-[#e8ecff] focus:outline-none"
                      style={inputStyle}
                    >
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                    <button
                      onClick={() => removeRecurringCost(cost.id)}
                      className="text-[rgba(239,68,68,0.8)] hover:text-[#ef4444] px-2"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Accounts Receivable */}
        <div className="p-5 rounded-[18px]" style={cardStyle}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-[rgba(232,236,255,0.5)] uppercase tracking-wide">
              Accounts Receivable
            </span>
            <ArrowUpRight className="h-4 w-4 text-[#22c55e]" />
          </div>
          <div className="text-[28px] font-bold text-[#22c55e]">
            {formatCurrency(data.accountsReceivable)}
          </div>
          <p className="text-[12px] text-[rgba(232,236,255,0.5)] mt-1">
            {data.recentInvoices.length} unpaid invoice{data.recentInvoices.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Accounts Payable */}
        <div className="p-5 rounded-[18px]" style={cardStyle}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-[rgba(232,236,255,0.5)] uppercase tracking-wide">
              Accounts Payable
            </span>
            <ArrowDownRight className="h-4 w-4 text-[#ef4444]" />
          </div>
          <div className="text-[28px] font-bold text-[#ef4444]">
            {formatCurrency(data.accountsPayable)}
          </div>
          <p className="text-[12px] text-[rgba(232,236,255,0.5)] mt-1">
            {data.pendingExpenses.length} pending reimbursement{data.pendingExpenses.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Net Position */}
        <div className="p-5 rounded-[18px]" style={cardStyle}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-[rgba(232,236,255,0.5)] uppercase tracking-wide">
              Net Position
            </span>
            <DollarSign className="h-4 w-4 text-[rgba(232,236,255,0.5)]" />
          </div>
          <div className={`text-[28px] font-bold ${netPosition >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
            {formatCurrency(netPosition)}
          </div>
          <p className="text-[12px] text-[rgba(232,236,255,0.5)] mt-1">
            AR - AP
          </p>
        </div>

        {/* Projected Cash (12 weeks) */}
        <div className="p-5 rounded-[18px]" style={cardStyle}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-[rgba(232,236,255,0.5)] uppercase tracking-wide">
              Projected Cash (12w)
            </span>
            <TrendingUp className="h-4 w-4 text-[rgba(232,236,255,0.5)]" />
          </div>
          <div className={`text-[28px] font-bold ${projectedCash >= 0 ? 'text-white' : 'text-[#ef4444]'}`}>
            {formatCurrency(projectedCash)}
          </div>
          <p className="text-[12px] text-[rgba(232,236,255,0.5)] mt-1">
            Based on current forecast
          </p>
        </div>
      </div>

      {/* Warning if overdue */}
      {overduePercentage > 20 && (
        <div
          className="p-4 rounded-[12px] flex items-center gap-3"
          style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)' }}
        >
          <AlertTriangle className="h-5 w-5 text-[#f59e0b]" />
          <div>
            <p className="text-[14px] font-medium text-[#f59e0b]">
              High Overdue Rate: {overduePercentage.toFixed(1)}%
            </p>
            <p className="text-[12px] text-[rgba(245,158,11,0.8)]">
              {formatCurrency(data.overdueAR)} in overdue invoices. Consider following up with customers.
            </p>
          </div>
        </div>
      )}

      {/* Cash Flow Forecast Chart */}
      <div className="rounded-[18px] overflow-hidden" style={cardStyle}>
        <div className="p-5 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
          <h2 className="text-[15px] font-semibold text-white">12-Week Cash Flow Forecast</h2>
          <p className="text-[12px] text-[rgba(232,236,255,0.5)] mt-1">
            Expected inflows and outflows based on invoice due dates and recurring costs
          </p>
        </div>
        <div className="p-5">
          <CashFlowChart data={data.forecast} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* AR Aging */}
        <div className="rounded-[18px] overflow-hidden" style={cardStyle}>
          <div className="p-5 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
            <h2 className="text-[15px] font-semibold text-white">AR Aging Analysis</h2>
          </div>
          <div className="p-5">
            <div className="space-y-3">
              {[
                { label: 'Current (Not Due)', value: data.invoicesByAge.current, color: '#22c55e' },
                { label: '1-30 Days Overdue', value: data.invoicesByAge.days1to30, color: '#f59e0b' },
                { label: '31-60 Days Overdue', value: data.invoicesByAge.days31to60, color: '#f97316' },
                { label: '60+ Days Overdue', value: data.invoicesByAge.days61plus, color: '#ef4444' },
              ].map(({ label, value, color }) => {
                const percentage = data.accountsReceivable > 0 ? (value / data.accountsReceivable) * 100 : 0
                return (
                  <div key={label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[13px] text-[rgba(232,236,255,0.7)]">{label}</span>
                      <span className="text-[13px] font-medium text-white">{formatCurrency(value)}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255, 255, 255, 0.08)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${percentage}%`, background: color }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Upcoming Invoices */}
        <div className="rounded-[18px] overflow-hidden" style={cardStyle}>
          <div className="p-5 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
            <h2 className="text-[15px] font-semibold text-white">Outstanding Invoices</h2>
          </div>
          <div className="p-5">
            {data.recentInvoices.length === 0 ? (
              <p className="text-[13px] text-[rgba(232,236,255,0.5)] text-center py-4">
                No outstanding invoices
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {data.recentInvoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between p-3 rounded-[10px]"
                    style={{ background: 'rgba(0, 0, 0, 0.2)' }}
                  >
                    <div>
                      <p className="text-[13px] font-medium text-white">
                        {invoice.documentNumber || 'Draft'}
                      </p>
                      <p className="text-[11px] text-[rgba(232,236,255,0.5)]">
                        {invoice.customerName}
                        {invoice.daysOverdue > 0 && (
                          <span className="text-[#f59e0b] ml-2">
                            {invoice.daysOverdue}d overdue
                          </span>
                        )}
                      </p>
                    </div>
                    <span className="text-[14px] font-semibold text-white">
                      {formatCurrency(invoice.total)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Monthly Summary */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="p-5 rounded-[18px]" style={cardStyle}>
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="h-5 w-5 text-[#22c55e]" />
            <span className="text-[11px] font-semibold text-[rgba(232,236,255,0.5)] uppercase tracking-wide">
              Revenue This Month
            </span>
          </div>
          <div className="text-[24px] font-bold text-white">
            {formatCurrency(data.revenueThisMonth)}
          </div>
          <p className="text-[12px] text-[rgba(232,236,255,0.5)] mt-1">
            From paid invoices
          </p>
        </div>

        <div className="p-5 rounded-[18px]" style={cardStyle}>
          <div className="flex items-center gap-3 mb-2">
            <TrendingDown className="h-5 w-5 text-[#f59e0b]" />
            <span className="text-[11px] font-semibold text-[rgba(232,236,255,0.5)] uppercase tracking-wide">
              Expenses This Month
            </span>
          </div>
          <div className="text-[24px] font-bold text-white">
            {formatCurrency(data.expensesThisMonth)}
          </div>
          <p className="text-[12px] text-[rgba(232,236,255,0.5)] mt-1">
            All submitted expenses
          </p>
        </div>
      </div>
    </div>
  )
}
