'use client'

import { useState } from 'react'
import { Play, ChevronDown, ChevronRight, CheckCircle2, XCircle, MinusCircle } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui'
import { cn } from '@/lib/utils'

interface TestResult {
  name: string
  category: string
  status: 'passed' | 'failed' | 'skipped'
  durationMs: number
  message?: string
  details?: Record<string, unknown>
}

interface TestRun {
  id: string
  started_at: string
  finished_at: string | null
  duration_ms: number | null
  total_tests: number
  passed: number
  failed: number
  skipped: number
  status: 'running' | 'passed' | 'failed'
  trigger_source: 'manual' | 'ci' | 'cron'
  triggered_by: string | null
  results: TestResult[]
}

interface Props {
  initialRuns: TestRun[]
}

function formatDuration(ms: number | null) {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function formatRelative(iso: string) {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return d.toLocaleString()
}

function StatusIcon({ status }: { status: TestResult['status'] }) {
  if (status === 'passed') return <CheckCircle2 className="h-4 w-4 text-success" />
  if (status === 'failed') return <XCircle className="h-4 w-4 text-danger" />
  return <MinusCircle className="h-4 w-4 text-text-muted" />
}

function RunSummaryBadge({ run }: { run: TestRun }) {
  if (run.status === 'running') return <Badge variant="info">Running</Badge>
  if (run.status === 'failed') return <Badge variant="danger">Failed</Badge>
  return <Badge variant="success">Passed</Badge>
}

function RunDetail({ run }: { run: TestRun }) {
  const grouped = run.results.reduce<Record<string, TestResult[]>>((acc, r) => {
    acc[r.category] = acc[r.category] || []
    acc[r.category].push(r)
    return acc
  }, {})

  return (
    <div className="space-y-4 pt-2">
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category}>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-2">
            {category}
          </h4>
          <ul className="space-y-1">
            {items.map((r, i) => (
              <li
                key={`${category}-${i}`}
                className="flex items-start gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <div className="mt-0.5">
                  <StatusIcon status={r.status} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium text-text-primary truncate">{r.name}</span>
                    <span className="shrink-0 text-xs text-text-muted">
                      {formatDuration(r.durationMs)}
                    </span>
                  </div>
                  {r.message && (
                    <div
                      className={cn(
                        'mt-0.5 text-xs',
                        r.status === 'failed' ? 'text-danger' : 'text-text-muted'
                      )}
                    >
                      {r.message}
                    </div>
                  )}
                  {r.details && (
                    <pre className="mt-1 overflow-x-auto rounded bg-surface px-2 py-1 text-[11px] text-text-muted">
                      {JSON.stringify(r.details, null, 2)}
                    </pre>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

export function TestsClient({ initialRuns }: Props) {
  const [runs, setRuns] = useState<TestRun[]>(initialRuns)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(initialRuns[0]?.id ?? null)

  const refresh = async () => {
    const res = await fetch('/api/admin/tests', { cache: 'no-store' })
    if (!res.ok) return
    const json = await res.json()
    setRuns(json.runs as TestRun[])
  }

  const handleRun = async () => {
    setRunning(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/tests', { method: 'POST' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || `HTTP ${res.status}`)
      }
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to run tests')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Run smoke tests</CardTitle>
              <p className="mt-1 text-sm text-text-secondary">
                Runs ~25 read-only checks against production: schema, fixtures, routing, external services, data integrity.
              </p>
            </div>
            <Button onClick={handleRun} isLoading={running} disabled={running}>
              {!running && <Play className="h-4 w-4" />}
              {running ? 'Running…' : 'Run tests'}
            </Button>
          </div>
        </CardHeader>
        {error && (
          <CardContent>
            <div className="rounded-md bg-danger-muted px-3 py-2 text-sm text-danger">{error}</div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent runs</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {runs.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-muted">
              No runs yet. Click &ldquo;Run tests&rdquo; above to record the first one.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {runs.map((run) => {
                const isOpen = expanded === run.id
                return (
                  <li key={run.id} className="py-3">
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : run.id)}
                      className="flex w-full items-center gap-3 text-left"
                    >
                      <div className="text-text-muted">
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </div>
                      <RunSummaryBadge run={run} />
                      <div className="flex-1 truncate text-sm">
                        <span className="text-text-primary font-medium">
                          {run.passed}/{run.total_tests} passed
                        </span>
                        {run.failed > 0 && (
                          <span className="ml-2 text-danger">{run.failed} failed</span>
                        )}
                        {run.skipped > 0 && (
                          <span className="ml-2 text-text-muted">{run.skipped} skipped</span>
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-text-muted">
                        {formatDuration(run.duration_ms)}
                      </span>
                      <Badge variant="secondary" className="shrink-0">
                        {run.trigger_source}
                      </Badge>
                      <span className="shrink-0 text-xs text-text-muted w-24 text-right">
                        {formatRelative(run.started_at)}
                      </span>
                    </button>
                    {isOpen && <RunDetail run={run} />}
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
