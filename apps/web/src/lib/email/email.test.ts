import { describe, it, expect } from 'vitest'
import {
  getInvoiceEmailHtml,
  getTeamInviteEmailHtml,
  getApprovalNotificationEmailHtml,
  getPaymentReminderEmailHtml,
} from './index'

describe('getInvoiceEmailHtml', () => {
  it('generates valid HTML with all required fields', () => {
    const html = getInvoiceEmailHtml({
      customerName: 'Acme Corp',
      documentNumber: 'INV-2026-00001',
      total: 1500.50,
      currency: 'EUR',
      dueDate: '15.01.2026',
      companyName: 'BOTFORCE GmbH',
    })

    expect(html).toContain('Acme Corp')
    expect(html).toContain('INV-2026-00001')
    expect(html).toContain('1500.50')
    expect(html).toContain('EUR')
    expect(html).toContain('15.01.2026')
    expect(html).toContain('BOTFORCE GmbH')
    expect(html).toContain('Invoice')
    expect(html).toContain('<!DOCTYPE html>')
  })

  it('includes payment due date', () => {
    const html = getInvoiceEmailHtml({
      customerName: 'Test',
      documentNumber: 'INV-001',
      total: 100,
      currency: 'EUR',
      dueDate: '01.02.2026',
      companyName: 'Test Co',
    })

    expect(html).toContain('Due Date')
    expect(html).toContain('01.02.2026')
  })
})

describe('getTeamInviteEmailHtml', () => {
  it('generates valid invitation HTML', () => {
    const html = getTeamInviteEmailHtml({
      inviterName: 'John Doe',
      companyName: 'BOTFORCE GmbH',
      role: 'Employee',
      inviteLink: 'https://app.botforce.at/login',
    })

    expect(html).toContain('John Doe')
    expect(html).toContain('BOTFORCE GmbH')
    expect(html).toContain('Employee')
    expect(html).toContain('https://app.botforce.at/login')
    expect(html).toContain('invited')
    expect(html).toContain('Accept Invitation')
  })

  it('includes expiration notice', () => {
    const html = getTeamInviteEmailHtml({
      inviterName: 'Admin',
      companyName: 'Company',
      role: 'Admin',
      inviteLink: 'https://example.com',
    })

    expect(html).toContain('expire')
  })
})

describe('getApprovalNotificationEmailHtml', () => {
  it('generates HTML for submitted timesheet', () => {
    const html = getApprovalNotificationEmailHtml({
      recipientName: 'John',
      type: 'timesheet',
      status: 'submitted',
      details: '40 hours for Project X',
      companyName: 'BOTFORCE',
    })

    expect(html).toContain('John')
    expect(html).toContain('Timesheet')
    expect(html).toContain('Submitted')
    expect(html).toContain('40 hours for Project X')
    expect(html).toContain('BOTFORCE')
  })

  it('generates HTML for approved expense', () => {
    const html = getApprovalNotificationEmailHtml({
      recipientName: 'Jane',
      type: 'expense',
      status: 'approved',
      details: '€150 for travel',
      companyName: 'BOTFORCE',
    })

    expect(html).toContain('Jane')
    expect(html).toContain('Expense')
    expect(html).toContain('Approved')
    expect(html).toContain('€150 for travel')
  })

  it('includes rejection reason when provided', () => {
    const html = getApprovalNotificationEmailHtml({
      recipientName: 'User',
      type: 'expense',
      status: 'rejected',
      details: 'Expense claim',
      reason: 'Missing receipt',
      companyName: 'Company',
    })

    expect(html).toContain('Rejected')
    expect(html).toContain('Missing receipt')
    expect(html).toContain('Reason')
  })
})

describe('getPaymentReminderEmailHtml', () => {
  it('generates payment reminder HTML', () => {
    const html = getPaymentReminderEmailHtml({
      customerName: 'Client ABC',
      documentNumber: 'INV-2026-00005',
      total: 2500,
      currency: 'EUR',
      dueDate: '01.01.2026',
      daysOverdue: 15,
      companyName: 'BOTFORCE GmbH',
    })

    expect(html).toContain('Client ABC')
    expect(html).toContain('INV-2026-00005')
    expect(html).toContain('2500.00')
    expect(html).toContain('15 days overdue')
    expect(html).toContain('Payment Reminder')
    expect(html).toContain('BOTFORCE GmbH')
  })

  it('uses urgent styling', () => {
    const html = getPaymentReminderEmailHtml({
      customerName: 'Test',
      documentNumber: 'INV-001',
      total: 100,
      currency: 'EUR',
      dueDate: '01.01.2026',
      daysOverdue: 30,
      companyName: 'Company',
    })

    // Check for red/warning color in the email
    expect(html).toContain('#dc3545')
  })
})
