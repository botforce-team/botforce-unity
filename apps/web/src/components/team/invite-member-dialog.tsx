'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, X } from 'lucide-react'
import { inviteTeamMember } from '@/app/actions/settings'

interface InviteMemberDialogProps {
  trigger?: React.ReactNode
}

export function InviteMemberDialog({ trigger }: InviteMemberDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const result = await inviteTeamMember(formData)

    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
      setTimeout(() => {
        setOpen(false)
        setSuccess(false)
        router.refresh()
      }, 2000)
    }
  }

  const inputStyle = {
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '10px',
  }

  return (
    <>
      {trigger ? (
        <div onClick={() => setOpen(true)}>{trigger}</div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-[12px] px-4 py-2 text-[13px] font-semibold text-white"
          style={{ background: '#1f5bff' }}
        >
          <UserPlus className="h-4 w-4" />
          Invite Member
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div
            className="relative w-full max-w-md rounded-[18px] p-6"
            style={{
              background: 'rgba(20, 25, 40, 0.98)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Invite Team Member</h2>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 transition-colors hover:bg-[rgba(255,255,255,0.1)]"
              >
                <X className="h-5 w-5 text-[rgba(232,236,255,0.5)]" />
              </button>
            </div>

            {success ? (
              <div className="py-8 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20">
                  <svg
                    className="h-6 w-6 text-green-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <p className="font-medium text-white">Invitation sent!</p>
                <p className="mt-1 text-[13px] text-[rgba(232,236,255,0.6)]">
                  The team member will receive an email invitation.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div
                    className="rounded-lg p-3 text-[13px] text-red-400"
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                    }}
                  >
                    {error}
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-[rgba(232,236,255,0.7)]">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    className="w-full px-3 py-2.5 text-[14px] text-white placeholder-[rgba(232,236,255,0.4)] focus:outline-none focus:ring-2 focus:ring-[#1f5bff]/50"
                    style={inputStyle}
                    placeholder="colleague@company.com"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-[13px] font-medium text-[rgba(232,236,255,0.7)]">
                      First Name
                    </label>
                    <input
                      type="text"
                      name="first_name"
                      className="w-full px-3 py-2.5 text-[14px] text-white placeholder-[rgba(232,236,255,0.4)] focus:outline-none focus:ring-2 focus:ring-[#1f5bff]/50"
                      style={inputStyle}
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[13px] font-medium text-[rgba(232,236,255,0.7)]">
                      Last Name
                    </label>
                    <input
                      type="text"
                      name="last_name"
                      className="w-full px-3 py-2.5 text-[14px] text-white placeholder-[rgba(232,236,255,0.4)] focus:outline-none focus:ring-2 focus:ring-[#1f5bff]/50"
                      style={inputStyle}
                      placeholder="Doe"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-[rgba(232,236,255,0.7)]">
                    Role *
                  </label>
                  <select
                    name="role"
                    required
                    className="w-full px-3 py-2.5 text-[14px] text-white focus:outline-none focus:ring-2 focus:ring-[#1f5bff]/50"
                    style={inputStyle}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Select a role
                    </option>
                    <option value="employee">Employee</option>
                    <option value="accountant">Accountant</option>
                    <option value="superadmin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-[rgba(232,236,255,0.7)]">
                    Hourly Rate (optional)
                  </label>
                  <input
                    type="number"
                    name="hourly_rate"
                    step="0.01"
                    min="0"
                    className="w-full px-3 py-2.5 text-[14px] text-white placeholder-[rgba(232,236,255,0.4)] focus:outline-none focus:ring-2 focus:ring-[#1f5bff]/50"
                    style={inputStyle}
                    placeholder="50.00"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex-1 rounded-[12px] px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[rgba(255,255,255,0.08)]"
                    style={{ border: '1px solid rgba(255, 255, 255, 0.12)' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 rounded-[12px] px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
                    style={{ background: '#1f5bff' }}
                  >
                    {loading ? 'Sending...' : 'Send Invitation'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
