import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './card'

describe('Card', () => {
  it('renders correctly', () => {
    render(<Card data-testid="card">Card content</Card>)
    const card = screen.getByTestId('card')
    expect(card).toBeInTheDocument()
    expect(card).toHaveClass('rounded-lg')
    expect(card).toHaveClass('border')
    expect(card).toHaveClass('bg-card')
  })

  it('accepts custom className', () => {
    render(
      <Card className="custom-card" data-testid="card">
        Content
      </Card>
    )
    const card = screen.getByTestId('card')
    expect(card).toHaveClass('custom-card')
  })

  it('forwards ref correctly', () => {
    const ref = { current: null }
    render(<Card ref={ref}>Content</Card>)
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })
})

describe('CardHeader', () => {
  it('renders correctly', () => {
    render(<CardHeader data-testid="header">Header</CardHeader>)
    const header = screen.getByTestId('header')
    expect(header).toBeInTheDocument()
    expect(header).toHaveClass('flex')
    expect(header).toHaveClass('flex-col')
    expect(header).toHaveClass('p-6')
  })

  it('accepts custom className', () => {
    render(
      <CardHeader className="custom-header" data-testid="header">
        Header
      </CardHeader>
    )
    const header = screen.getByTestId('header')
    expect(header).toHaveClass('custom-header')
  })
})

describe('CardTitle', () => {
  it('renders as h3', () => {
    render(<CardTitle>My Title</CardTitle>)
    const title = screen.getByRole('heading', { level: 3 })
    expect(title).toBeInTheDocument()
    expect(title).toHaveTextContent('My Title')
  })

  it('applies correct styles', () => {
    render(<CardTitle data-testid="title">Title</CardTitle>)
    const title = screen.getByTestId('title')
    expect(title).toHaveClass('text-2xl')
    expect(title).toHaveClass('font-semibold')
  })

  it('accepts custom className', () => {
    render(
      <CardTitle className="custom-title" data-testid="title">
        Title
      </CardTitle>
    )
    const title = screen.getByTestId('title')
    expect(title).toHaveClass('custom-title')
  })
})

describe('CardDescription', () => {
  it('renders correctly', () => {
    render(<CardDescription>Description text</CardDescription>)
    const description = screen.getByText('Description text')
    expect(description).toBeInTheDocument()
    expect(description).toHaveClass('text-sm')
    expect(description).toHaveClass('text-muted-foreground')
  })

  it('accepts custom className', () => {
    render(<CardDescription className="custom-desc">Description</CardDescription>)
    const description = screen.getByText('Description')
    expect(description).toHaveClass('custom-desc')
  })
})

describe('CardContent', () => {
  it('renders correctly', () => {
    render(<CardContent data-testid="content">Content here</CardContent>)
    const content = screen.getByTestId('content')
    expect(content).toBeInTheDocument()
    expect(content).toHaveClass('p-6')
    expect(content).toHaveClass('pt-0')
  })

  it('accepts custom className', () => {
    render(
      <CardContent className="custom-content" data-testid="content">
        Content
      </CardContent>
    )
    const content = screen.getByTestId('content')
    expect(content).toHaveClass('custom-content')
  })
})

describe('CardFooter', () => {
  it('renders correctly', () => {
    render(<CardFooter data-testid="footer">Footer</CardFooter>)
    const footer = screen.getByTestId('footer')
    expect(footer).toBeInTheDocument()
    expect(footer).toHaveClass('flex')
    expect(footer).toHaveClass('items-center')
    expect(footer).toHaveClass('p-6')
  })

  it('accepts custom className', () => {
    render(
      <CardFooter className="custom-footer" data-testid="footer">
        Footer
      </CardFooter>
    )
    const footer = screen.getByTestId('footer')
    expect(footer).toHaveClass('custom-footer')
  })
})

describe('Card composition', () => {
  it('renders a complete card with all parts', () => {
    render(
      <Card data-testid="full-card">
        <CardHeader>
          <CardTitle>Project Alpha</CardTitle>
          <CardDescription>A description of the project</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Main content goes here</p>
        </CardContent>
        <CardFooter>
          <button>Save</button>
        </CardFooter>
      </Card>
    )

    expect(screen.getByTestId('full-card')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /project alpha/i })).toBeInTheDocument()
    expect(screen.getByText(/description of the project/i)).toBeInTheDocument()
    expect(screen.getByText(/main content goes here/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
  })
})
