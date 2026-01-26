'use client'

import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, TrendingDown, DollarSign, Users, FileText, Clock } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface RevenueByCustomer {
  customerName: string
  revenue: number
  invoiceCount: number
}

interface RevenueByMonth {
  month: string
  revenue: number
  expenses: number
  profit: number
}

interface ReportData {
  totalRevenue: number
  totalExpenses: number
  netProfit: number
  revenueChange: number // Percentage change from last period
  customerCount: number
  invoiceCount: number
  averageInvoiceValue: number
  outstandingAR: number
  revenueByCustomer: RevenueByCustomer[]
  revenueByMonth: RevenueByMonth[]
}

interface RevenueReportProps {
  data: ReportData
  period?: string
}

const COLORS = ['#1f5bff', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16']

const cardStyle = {
  background: 'rgba(255, 255, 255, 0.04)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
}

export function RevenueReport({ data, period = 'This Month' }: RevenueReportProps) {
  const profitMargin = data.totalRevenue > 0 ? ((data.netProfit / data.totalRevenue) * 100).toFixed(1) : '0'

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="Total Revenue"
          value={formatCurrency(data.totalRevenue)}
          change={data.revenueChange}
          icon={<DollarSign className="h-5 w-5" />}
          color="#22c55e"
        />
        <KPICard
          title="Net Profit"
          value={formatCurrency(data.netProfit)}
          subtitle={`${profitMargin}% margin`}
          icon={<TrendingUp className="h-5 w-5" />}
          color="#1f5bff"
        />
        <KPICard
          title="Outstanding AR"
          value={formatCurrency(data.outstandingAR)}
          subtitle={`${data.invoiceCount} invoices`}
          icon={<FileText className="h-5 w-5" />}
          color="#f59e0b"
        />
        <KPICard
          title="Avg Invoice"
          value={formatCurrency(data.averageInvoiceValue)}
          subtitle={`${data.customerCount} customers`}
          icon={<Users className="h-5 w-5" />}
          color="#8b5cf6"
        />
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Revenue by Month */}
        <div className="rounded-[18px] p-5" style={cardStyle}>
          <h3 className="text-[15px] font-semibold text-white mb-4">Revenue & Expenses Trend</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.revenueByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: 'rgba(232,236,255,0.5)', fontSize: 11 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                />
                <YAxis
                  tick={{ fill: 'rgba(232,236,255,0.5)', fontSize: 11 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                  tickFormatter={(value) => `€${value / 1000}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: 'white',
                  }}
                  formatter={(value: number) => [formatCurrency(value), '']}
                />
                <Legend wrapperStyle={{ paddingTop: 16 }} />
                <Bar dataKey="revenue" name="Revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue by Customer */}
        <div className="rounded-[18px] p-5" style={cardStyle}>
          <h3 className="text-[15px] font-semibold text-white mb-4">Revenue by Customer</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.revenueByCustomer}
                  dataKey="revenue"
                  nameKey="customerName"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  innerRadius={60}
                  paddingAngle={2}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={{ stroke: 'rgba(255,255,255,0.3)' }}
                >
                  {data.revenueByCustomer.map((entry, index) => (
                    <Cell key={entry.customerName} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: 'white',
                  }}
                  formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Customer Revenue Table */}
      <div className="rounded-[18px] overflow-hidden" style={cardStyle}>
        <div className="p-5 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
          <h3 className="text-[15px] font-semibold text-white">Revenue Breakdown by Customer</h3>
        </div>
        <div className="p-5">
          <table className="w-full">
            <thead>
              <tr className="border-b text-[11px] font-semibold uppercase tracking-wide" style={{ borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(232,236,255,0.5)' }}>
                <th className="pb-3 text-left">Customer</th>
                <th className="pb-3 text-right">Invoices</th>
                <th className="pb-3 text-right">Revenue</th>
                <th className="pb-3 text-right">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {data.revenueByCustomer.map((customer, index) => (
                <tr
                  key={customer.customerName}
                  className="border-b last:border-0 text-[13px]"
                  style={{ borderColor: 'rgba(255,255,255,0.06)' }}
                >
                  <td className="py-3 flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-white">{customer.customerName}</span>
                  </td>
                  <td className="py-3 text-right text-[rgba(232,236,255,0.7)]">
                    {customer.invoiceCount}
                  </td>
                  <td className="py-3 text-right font-medium text-white">
                    {formatCurrency(customer.revenue)}
                  </td>
                  <td className="py-3 text-right text-[rgba(232,236,255,0.5)]">
                    {data.totalRevenue > 0
                      ? ((customer.revenue / data.totalRevenue) * 100).toFixed(1)
                      : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

interface KPICardProps {
  title: string
  value: string
  change?: number
  subtitle?: string
  icon: React.ReactNode
  color: string
}

function KPICard({ title, value, change, subtitle, icon, color }: KPICardProps) {
  return (
    <div className="rounded-[18px] p-5" style={cardStyle}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12px] text-[rgba(232,236,255,0.5)] uppercase tracking-wide">{title}</span>
        <div
          className="p-2 rounded-lg"
          style={{ backgroundColor: `${color}20` }}
        >
          <div style={{ color }}>{icon}</div>
        </div>
      </div>
      <div className="text-2xl font-bold text-white mb-1">{value}</div>
      {change !== undefined && (
        <div className="flex items-center gap-1">
          {change >= 0 ? (
            <TrendingUp className="h-4 w-4 text-green-500" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-500" />
          )}
          <span className={`text-[12px] ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {change >= 0 ? '+' : ''}{change.toFixed(1)}%
          </span>
          <span className="text-[12px] text-[rgba(232,236,255,0.4)]">vs last period</span>
        </div>
      )}
      {subtitle && (
        <span className="text-[12px] text-[rgba(232,236,255,0.5)]">{subtitle}</span>
      )}
    </div>
  )
}
