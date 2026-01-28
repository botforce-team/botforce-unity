import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  successResponse,
  unauthorizedResponse,
  errorResponse,
  checkRateLimit,
  rateLimitResponse,
} from '@/lib/api-utils'
import { logError } from '@/lib/errors'

interface SearchResult {
  id: string
  type: 'customer' | 'project' | 'document'
  title: string
  subtitle: string | null
  href: string
}

interface SearchResponse {
  results: SearchResult[]
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Rate limiting - 60 requests per minute per IP
    const ip = request.headers.get('x-forwarded-for') || 'anonymous'
    const rateCheck = checkRateLimit(`search:${ip}`, 60, 60000)
    if (!rateCheck.allowed) {
      return rateLimitResponse(Math.ceil((rateCheck.resetAt - Date.now()) / 1000))
    }

    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q')?.trim()

    if (!query || query.length < 2) {
      return successResponse<SearchResponse>({ results: [] })
    }

    // Limit query length to prevent abuse
    if (query.length > 100) {
      return errorResponse('Query too long', 400, 'QUERY_TOO_LONG')
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return unauthorizedResponse()
    }

    // Escape special characters for LIKE pattern
    const escapedQuery = query.replace(/[%_]/g, '\\$&')
    const searchPattern = `%${escapedQuery}%`

    // Run searches in parallel for better performance
    const [customersResult, projectsResult, documentsResult] = await Promise.all([
      supabase
        .from('customers')
        .select('id, name, email, city')
        .or(`name.ilike.${searchPattern},email.ilike.${searchPattern}`)
        .limit(5),
      supabase
        .from('projects')
        .select('id, name, code, customers(name)')
        .or(`name.ilike.${searchPattern},code.ilike.${searchPattern}`)
        .limit(5),
      supabase
        .from('documents')
        .select('id, document_number, document_type, customers(name)')
        .ilike('document_number', searchPattern)
        .limit(5),
    ])

    // Log any errors but don't fail the whole request
    if (customersResult.error) {
      logError(customersResult.error, { context: 'search-customers' })
    }
    if (projectsResult.error) {
      logError(projectsResult.error, { context: 'search-projects' })
    }
    if (documentsResult.error) {
      logError(documentsResult.error, { context: 'search-documents' })
    }

    const customers = customersResult.data || []
    const projects = projectsResult.data || []
    const documents = documentsResult.data || []

    const results: SearchResult[] = [
      ...customers.map((c) => ({
        id: c.id,
        type: 'customer' as const,
        title: c.name,
        subtitle: c.email || c.city || null,
        href: `/customers/${c.id}`,
      })),
      ...projects.map((p) => {
        const customer = p.customers as unknown as { name: string } | null
        return {
          id: p.id,
          type: 'project' as const,
          title: p.name,
          subtitle: `${p.code}${customer ? ` • ${customer.name}` : ''}`,
          href: `/projects/${p.id}`,
        }
      }),
      ...documents.map((d) => {
        const customer = d.customers as unknown as { name: string } | null
        return {
          id: d.id,
          type: 'document' as const,
          title: d.document_number || 'Draft',
          subtitle: `${d.document_type}${customer ? ` • ${customer.name}` : ''}`,
          href: `/documents/${d.id}`,
        }
      }),
    ]

    return successResponse<SearchResponse>({ results })
  } catch (error) {
    logError(error, { route: 'api/search' })
    return errorResponse('Search failed', 500, 'SEARCH_ERROR')
  }
}
