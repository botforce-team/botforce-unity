import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge } from './badge'

describe('Badge', () => {
  it('renders children correctly', () => {
    render(<Badge>Status</Badge>)
    expect(screen.getByText('Status')).toBeInTheDocument()
  })

  it('applies default variant styles', () => {
    render(<Badge data-testid="badge">Default</Badge>)
    const badge = screen.getByTestId('badge')
    expect(badge).toHaveClass('bg-surface-border')
    expect(badge).toHaveClass('text-text-secondary')
  })

  describe('variants', () => {
    it('applies secondary variant', () => {
      render(<Badge variant="secondary" data-testid="badge">Secondary</Badge>)
      const badge = screen.getByTestId('badge')
      expect(badge).toHaveClass('bg-surface')
      expect(badge).toHaveClass('border')
    })

    it('applies primary variant', () => {
      render(<Badge variant="primary" data-testid="badge">Primary</Badge>)
      const badge = screen.getByTestId('badge')
      expect(badge).toHaveClass('bg-primary-muted')
      expect(badge).toHaveClass('text-primary')
    })

    it('applies success variant', () => {
      render(<Badge variant="success" data-testid="badge">Success</Badge>)
      const badge = screen.getByTestId('badge')
      expect(badge).toHaveClass('bg-success-muted')
      expect(badge).toHaveClass('text-success')
    })

    it('applies warning variant', () => {
      render(<Badge variant="warning" data-testid="badge">Warning</Badge>)
      const badge = screen.getByTestId('badge')
      expect(badge).toHaveClass('bg-warning-muted')
      expect(badge).toHaveClass('text-warning')
    })

    it('applies danger variant', () => {
      render(<Badge variant="danger" data-testid="badge">Danger</Badge>)
      const badge = screen.getByTestId('badge')
      expect(badge).toHaveClass('bg-danger-muted')
      expect(badge).toHaveClass('text-danger')
    })

    it('applies info variant', () => {
      render(<Badge variant="info" data-testid="badge">Info</Badge>)
      const badge = screen.getByTestId('badge')
      expect(badge).toHaveClass('bg-info-muted')
      expect(badge).toHaveClass('text-info')
    })
  })

  it('renders as span element', () => {
    render(<Badge>Status</Badge>)
    const badge = screen.getByText('Status')
    expect(badge.tagName).toBe('SPAN')
  })

  it('merges custom className', () => {
    render(<Badge className="custom-class" data-testid="badge">Badge</Badge>)
    expect(screen.getByTestId('badge')).toHaveClass('custom-class')
  })

  it('applies base styles', () => {
    render(<Badge data-testid="badge">Badge</Badge>)
    const badge = screen.getByTestId('badge')
    expect(badge).toHaveClass('inline-flex')
    expect(badge).toHaveClass('items-center')
    expect(badge).toHaveClass('rounded')
    expect(badge).toHaveClass('text-xs')
    expect(badge).toHaveClass('font-medium')
  })

  it('passes through HTML attributes', () => {
    render(<Badge data-testid="badge" title="Status badge">Badge</Badge>)
    expect(screen.getByTestId('badge')).toHaveAttribute('title', 'Status badge')
  })
})
