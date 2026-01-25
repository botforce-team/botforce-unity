'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  const handleSignUp = async () => {
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
    } else {
      setError('Check your email for the confirmation link.')
    }
    setLoading(false)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        background: `
          radial-gradient(1200px 700px at 50% 0%, rgba(31, 91, 255, 0.16), transparent 60%),
          #0b1020
        `,
      }}
    >
      <div className="w-full max-w-sm">
        {/* Logo and Branding */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Image
              src="/logo.png"
              alt="BOTFORCE"
              width={48}
              height={48}
              className="h-12 w-auto"
            />
            <div className="flex flex-col">
              <span className="text-xl font-bold text-white tracking-wide">BOTFORCE</span>
              <span className="text-[10px] font-medium text-[rgba(255,255,255,0.5)] uppercase tracking-widest">Unity</span>
            </div>
          </div>
          <p className="text-[13px] text-[rgba(232,236,255,0.68)] mt-2">Business Management Platform</p>
        </div>

        {/* Login Card */}
        <div
          className="p-6 rounded-[18px]"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <h2 className="text-lg font-semibold text-white text-center mb-1">Welcome back</h2>
          <p className="text-[13px] text-[rgba(232,236,255,0.68)] text-center mb-6">Sign in to access your workspace</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
                Email
              </label>
              <input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] placeholder:text-[rgba(232,236,255,0.4)] focus:outline-none transition-all"
                style={{
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#1f5bff'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(31, 91, 255, 0.18)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[rgba(232,236,255,0.68)] uppercase tracking-wide mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-[12px] text-[13px] text-[#e8ecff] placeholder:text-[rgba(232,236,255,0.4)] focus:outline-none transition-all"
                style={{
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#1f5bff'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(31, 91, 255, 0.18)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            </div>

            {error && (
              <div
                className="text-[13px] p-3 rounded-[10px]"
                style={{
                  background: error.includes('Check your email')
                    ? 'rgba(34, 197, 94, 0.12)'
                    : 'rgba(239, 68, 68, 0.12)',
                  border: `1px solid ${error.includes('Check your email')
                    ? 'rgba(34, 197, 94, 0.35)'
                    : 'rgba(239, 68, 68, 0.35)'}`,
                  color: error.includes('Check your email') ? '#4ade80' : '#f87171',
                }}
              >
                {error}
              </div>
            )}

            <div className="flex flex-col gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-[12px] text-[13px] font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: '#1f5bff',
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.background = '#3d72ff'
                    e.currentTarget.style.transform = 'translateY(-1px)'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#1f5bff'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>

              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)' }} />
                </div>
                <span className="relative px-3 text-[11px] uppercase text-[rgba(255,255,255,0.4)]" style={{ background: 'transparent' }}>
                  or
                </span>
              </div>

              <button
                type="button"
                onClick={handleSignUp}
                disabled={loading}
                className="w-full py-2.5 rounded-[12px] text-[13px] font-medium text-[rgba(255,255,255,0.8)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                }}
              >
                Create an account
              </button>
            </div>
          </form>
        </div>

        <p className="text-center text-[11px] text-[rgba(255,255,255,0.4)] mt-6">
          BOTFORCE GmbH · Vienna, Austria
        </p>
      </div>
    </div>
  )
}
