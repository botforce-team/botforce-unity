'use client'

import { useState, useEffect } from 'react'
import { Sparkles, RefreshCw, AlertTriangle, Lightbulb, Calendar, TrendingUp, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface TaxInsightsWidgetProps {
  hasApiKey?: boolean
}

export function TaxInsightsWidget({ hasApiKey = false }: TaxInsightsWidgetProps) {
  const [insights, setInsights] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchInsights = async () => {
    if (!hasApiKey) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/tax-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'insights' }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to fetch insights')
      }

      const data = await response.json()
      setInsights(data.message)
      setLastUpdated(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load insights')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (hasApiKey) {
      fetchInsights()
    }
  }, [hasApiKey])

  // Parse insights into structured items
  const parseInsights = (text: string): Array<{ type: 'warning' | 'tip' | 'deadline' | 'opportunity'; text: string }> => {
    const items: Array<{ type: 'warning' | 'tip' | 'deadline' | 'opportunity'; text: string }> = []

    // Split by numbered items or bullet points
    const lines = text.split(/\n/).filter(line => line.trim())

    lines.forEach(line => {
      const cleanLine = line.replace(/^[\d\.\-\*\•]+\s*/, '').trim()
      if (!cleanLine) return

      // Determine type based on content
      let type: 'warning' | 'tip' | 'deadline' | 'opportunity' = 'tip'
      if (cleanLine.toLowerCase().includes('deadline') || cleanLine.toLowerCase().includes('frist') || cleanLine.toLowerCase().includes('termin')) {
        type = 'deadline'
      } else if (cleanLine.toLowerCase().includes('risk') || cleanLine.toLowerCase().includes('warning') || cleanLine.toLowerCase().includes('achtung') || cleanLine.toLowerCase().includes('overdue')) {
        type = 'warning'
      } else if (cleanLine.toLowerCase().includes('opportunity') || cleanLine.toLowerCase().includes('save') || cleanLine.toLowerCase().includes('optimi') || cleanLine.toLowerCase().includes('sparen')) {
        type = 'opportunity'
      }

      items.push({ type, text: cleanLine })
    })

    return items.slice(0, 5) // Max 5 items
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-warning" />
      case 'deadline':
        return <Calendar className="h-4 w-4 text-primary" />
      case 'opportunity':
        return <TrendingUp className="h-4 w-4 text-success" />
      default:
        return <Lightbulb className="h-4 w-4 text-info" />
    }
  }

  if (!hasApiKey) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Tax Advisor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Sparkles className="h-12 w-12 mx-auto text-text-muted mb-3" />
            <p className="text-text-secondary mb-2">AI Tax Advisor is not configured</p>
            <p className="text-sm text-text-muted mb-4">Add your Anthropic API key to enable AI-powered tax insights.</p>
            <Link
              href="/settings?tab=integrations"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium h-8 px-3 bg-transparent text-text-primary border border-border hover:bg-surface-hover transition-colors"
            >
              Configure
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Tax Insights
        </CardTitle>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-text-muted">
              {lastUpdated.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchInsights}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && !insights ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-text-muted">Analyzing your finances...</span>
          </div>
        ) : error ? (
          <div className="text-center py-6">
            <AlertTriangle className="h-8 w-8 mx-auto text-warning mb-2" />
            <p className="text-sm text-text-secondary">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchInsights} className="mt-3">
              Retry
            </Button>
          </div>
        ) : insights ? (
          <div className="space-y-3">
            {parseInsights(insights).map((item, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 rounded-lg bg-surface hover:bg-surface/80 transition-colors"
              >
                <div className="mt-0.5">{getIcon(item.type)}</div>
                <p className="text-sm text-text-secondary flex-1">{item.text}</p>
              </div>
            ))}

            <div className="pt-3 border-t border-border">
              <Link
                href="/finance/tax-advisor"
                className="flex items-center justify-between text-sm text-primary hover:underline"
              >
                <span>Ask the Tax Advisor</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <p className="text-xs text-text-muted italic pt-2">
              AI-generated advice. Consult a certified Steuerberater for official guidance.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
