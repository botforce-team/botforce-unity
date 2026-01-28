import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')?.trim()

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] })
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchPattern = `%${query}%`

  // Search customers
  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, email, city')
    .or(`name.ilike.${searchPattern},email.ilike.${searchPattern}`)
    .limit(5)

  // Search projects
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, code, customers(name)')
    .or(`name.ilike.${searchPattern},code.ilike.${searchPattern}`)
    .limit(5)

  // Search documents
  const { data: documents } = await supabase
    .from('documents')
    .select('id, document_number, document_type, customers(name)')
    .ilike('document_number', searchPattern)
    .limit(5)

  const results = [
    ...(customers?.map((c) => ({
      id: c.id,
      type: 'customer' as const,
      title: c.name,
      subtitle: c.email || c.city,
      href: `/customers/${c.id}`,
    })) || []),
    ...(projects?.map((p) => {
      const customer = p.customers as unknown as { name: string } | null
      return {
        id: p.id,
        type: 'project' as const,
        title: p.name,
        subtitle: `${p.code}${customer ? ` • ${customer.name}` : ''}`,
        href: `/projects/${p.id}`,
      }
    }) || []),
    ...(documents?.map((d) => {
      const customer = d.customers as unknown as { name: string } | null
      return {
        id: d.id,
        type: 'document' as const,
        title: d.document_number || 'Draft',
        subtitle: `${d.document_type}${customer ? ` • ${customer.name}` : ''}`,
        href: `/documents/${d.id}`,
      }
    }) || []),
  ]

  return NextResponse.json({ results })
}
