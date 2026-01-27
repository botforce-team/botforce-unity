// Force dynamic rendering for login pages since they require
// Supabase environment variables at runtime
export const dynamic = 'force-dynamic'

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
