'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  FileText,
  Clock,
  Receipt,
  Building2,
  Calendar,
  CheckCircle,
  Loader2,
  ChevronRight,
} from 'lucide-react'
import { Button, Card, Badge, Select, Input, Label } from '@/components/ui'
import { MonthPicker } from '@/components/ui/month-picker'
import {
  getUnbilledItemsForProjectMonth,
  createInvoiceForProjectMonth,
} from '@/app/actions/invoicing'
import { formatCurrency, formatDate, getMonthYearDisplay } from '@/lib/utils'
import type { UnbilledTimeEntry, UnbilledExpense } from '@/app/actions/invoicing'

interface Project {
  value: string
  label: string
  code: string
  customerId: string
  customerName: string
  unbilledHours: number
  unbilledExpenseCount: number
  unbilledMonths: string[]
}

interface ProjectInvoiceFormProps {
  projects: Project[]
  defaultProjectId?: string
  defaultMonth?: string
}

export function ProjectInvoiceForm({
  projects,
  defaultProjectId,
  defaultMonth,
}: ProjectInvoiceFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Form state
  const [projectId, setProjectId] = useState(defaultProjectId || '')
  const [yearMonth, setYearMonth] = useState(defaultMonth || '')
  const [includeTime, setIncludeTime] = useState(true)
  const [includeExpenses, setIncludeExpenses] = useState(true)
  const [paymentTerms, setPaymentTerms] = useState('14')
  const [notes, setNotes] = useState('')
  const [groupBy, setGroupBy] = useState<'project' | 'entry' | 'summary'>('project')

  // Preview data
  const [timeEntries, setTimeEntries] = useState<UnbilledTimeEntry[]>([])
  const [expenses, setExpenses] = useState<UnbilledExpense[]>([])
  const [summary, setSummary] = useState<{
    totalHours: number
    totalTimeValue: number
    totalExpenses: number
    estimatedTotal: number
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get selected project
  const selectedProject = projects.find((p) => p.value === projectId)

  // Load preview when project and month change
  useEffect(() => {
    if (!projectId || !yearMonth) {
      setTimeEntries([])
      setExpenses([])
      setSummary(null)
      return
    }

    setIsLoading(true)
    setError(null)

    getUnbilledItemsForProjectMonth(projectId, yearMonth)
      .then((data) => {
        setTimeEntries(data.timeEntries)
        setExpenses(data.expenses)
        setSummary(data.summary)
      })
      .catch((err) => {
        setError('Fehler beim Laden der Daten')
        console.error(err)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [projectId, yearMonth])

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!projectId || !yearMonth) {
      setError('Bitte wähle ein Projekt und einen Monat')
      return
    }

    if (!includeTime && !includeExpenses) {
      setError('Bitte wähle mindestens Zeiten oder Ausgaben aus')
      return
    }

    startTransition(async () => {
      const result = await createInvoiceForProjectMonth({
        project_id: projectId,
        year_month: yearMonth,
        include_time_entries: includeTime,
        include_expenses: includeExpenses,
        payment_terms_days: parseInt(paymentTerms, 10),
        notes: notes || null,
        group_by: groupBy,
      })

      if (result.success && result.data) {
        router.push(`/documents/${result.data.id}`)
      } else {
        setError(result.error || 'Fehler beim Erstellen der Rechnung')
      }
    })
  }

  // Calculate totals based on selections
  const calculateTotal = () => {
    let total = 0
    if (includeTime && summary) {
      total += summary.totalTimeValue
    }
    if (includeExpenses && summary) {
      total += summary.totalExpenses
    }
    return total
  }

  // Get available months for selected project
  const availableMonths = selectedProject?.unbilledMonths || []

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-3">
      {/* Left Column - Selection */}
      <div className="lg:col-span-2 space-y-6">
        {/* Project Selection */}
        <Card>
          <div className="p-4 border-b border-border">
            <h2 className="font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Projekt auswählen
            </h2>
          </div>
          <div className="p-4">
            <Select
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value)
                // Reset month when project changes
                setYearMonth('')
              }}
              className="w-full"
            >
              <option value="">Projekt wählen...</option>
              {projects.map((project) => (
                <option key={project.value} value={project.value}>
                  {project.label} - {project.customerName} ({project.unbilledHours}h)
                </option>
              ))}
            </Select>

            {selectedProject && (
              <div className="mt-4 p-3 bg-surface rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{selectedProject.label}</p>
                    <p className="text-sm text-text-secondary">{selectedProject.customerName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">
                      <span className="font-medium">{selectedProject.unbilledHours}h</span>{' '}
                      <span className="text-text-muted">unbilled</span>
                    </p>
                    {selectedProject.unbilledExpenseCount > 0 && (
                      <p className="text-xs text-text-muted">
                        + {selectedProject.unbilledExpenseCount} Ausgaben
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Month Selection */}
        <Card>
          <div className="p-4 border-b border-border">
            <h2 className="font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Monat auswählen
            </h2>
          </div>
          <div className="p-4">
            {availableMonths.length > 0 ? (
              <div className="space-y-3">
                {/* Quick select buttons for available months */}
                <div className="flex flex-wrap gap-2">
                  {availableMonths.slice(0, 6).map((month) => (
                    <button
                      key={month}
                      type="button"
                      onClick={() => setYearMonth(month)}
                      className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                        yearMonth === month
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-surface border-border hover:border-primary'
                      }`}
                    >
                      {getMonthYearDisplay(month)}
                    </button>
                  ))}
                </div>

                {/* Custom month picker */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-text-muted">Oder:</span>
                  <MonthPicker
                    value={yearMonth}
                    onChange={setYearMonth}
                    placeholder="Anderen Monat wählen"
                    className="flex-1"
                  />
                </div>
              </div>
            ) : (
              <MonthPicker
                value={yearMonth}
                onChange={setYearMonth}
                placeholder="Monat wählen"
                className="w-full"
              />
            )}
          </div>
        </Card>

        {/* Preview */}
        {(isLoading || timeEntries.length > 0 || expenses.length > 0) && (
          <Card>
            <div className="p-4 border-b border-border">
              <h2 className="font-medium">Vorschau</h2>
            </div>
            <div className="p-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
                  <span className="ml-2 text-text-muted">Lade Daten...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Time Entries */}
                  {timeEntries.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={includeTime}
                            onChange={(e) => setIncludeTime(e.target.checked)}
                            className="rounded border-border"
                          />
                          <Clock className="h-4 w-4 text-text-muted" />
                          <span className="font-medium">Zeiteinträge ({timeEntries.length})</span>
                        </label>
                        <span className="text-sm font-medium">
                          {summary && formatCurrency(summary.totalTimeValue)}
                        </span>
                      </div>
                      {includeTime && (
                        <div className="ml-6 space-y-1 max-h-48 overflow-y-auto">
                          {timeEntries.map((entry) => (
                            <div
                              key={entry.id}
                              className="flex items-center justify-between text-sm py-1 border-b border-border/50 last:border-0"
                            >
                              <span className="text-text-secondary">
                                {formatDate(entry.date)} - {entry.description || 'Arbeit'}
                              </span>
                              <span className="font-medium">{entry.hours}h</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Expenses */}
                  {expenses.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={includeExpenses}
                            onChange={(e) => setIncludeExpenses(e.target.checked)}
                            className="rounded border-border"
                          />
                          <Receipt className="h-4 w-4 text-text-muted" />
                          <span className="font-medium">Ausgaben ({expenses.length})</span>
                        </label>
                        <span className="text-sm font-medium">
                          {summary && formatCurrency(summary.totalExpenses)}
                        </span>
                      </div>
                      {includeExpenses && (
                        <div className="ml-6 space-y-1 max-h-48 overflow-y-auto">
                          {expenses.map((exp) => (
                            <div
                              key={exp.id}
                              className="flex items-center justify-between text-sm py-1 border-b border-border/50 last:border-0"
                            >
                              <span className="text-text-secondary">
                                {formatDate(exp.date)} - {exp.merchant || exp.category}
                              </span>
                              <span className="font-medium">
                                {formatCurrency(exp.amount + exp.tax_amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {timeEntries.length === 0 && expenses.length === 0 && (
                    <div className="text-center py-8 text-text-muted">
                      Keine abrechenbaren Posten für diesen Monat gefunden
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* Right Column - Options & Actions */}
      <div className="space-y-6">
        {/* Options */}
        <Card>
          <div className="p-4 border-b border-border">
            <h2 className="font-medium">Optionen</h2>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <Label htmlFor="groupBy">Gruppierung</Label>
              <Select
                id="groupBy"
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as any)}
                className="mt-1"
              >
                <option value="project">Nach Projekt (Stunden summiert)</option>
                <option value="summary">Zusammenfassung</option>
                <option value="entry">Einzelne Einträge</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="paymentTerms">Zahlungsziel (Tage)</Label>
              <Input
                id="paymentTerms"
                type="number"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                min="0"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="notes">Notizen (erscheinen auf Rechnung)</Label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                rows={3}
                placeholder="Optionale Notizen..."
              />
            </div>
          </div>
        </Card>

        {/* Summary & Action */}
        <Card>
          <div className="p-4 border-b border-border">
            <h2 className="font-medium">Zusammenfassung</h2>
          </div>
          <div className="p-4 space-y-4">
            {summary && (includeTime || includeExpenses) ? (
              <>
                {includeTime && (
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Zeiten ({summary.totalHours}h)</span>
                    <span>{formatCurrency(summary.totalTimeValue)}</span>
                  </div>
                )}
                {includeExpenses && (
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Ausgaben</span>
                    <span>{formatCurrency(summary.totalExpenses)}</span>
                  </div>
                )}
                <div className="flex justify-between font-medium pt-2 border-t border-border">
                  <span>Geschätzte Summe</span>
                  <span className="text-lg">{formatCurrency(calculateTotal())}</span>
                </div>
                <p className="text-xs text-text-muted">
                  * Endgültige Beträge können je nach USt-Satz abweichen
                </p>
              </>
            ) : (
              <p className="text-text-muted text-center py-4">
                Wähle Projekt und Monat
              </p>
            )}

            {error && (
              <div className="p-3 rounded-md bg-danger/10 text-danger text-sm">{error}</div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={
                isPending ||
                !projectId ||
                !yearMonth ||
                (!includeTime && !includeExpenses) ||
                (timeEntries.length === 0 && expenses.length === 0)
              }
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Erstelle Rechnung...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Rechnung erstellen
                </>
              )}
            </Button>
          </div>
        </Card>
      </div>
    </form>
  )
}
