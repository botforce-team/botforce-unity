'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Archive } from 'lucide-react'
import { deleteProject, archiveProject } from '@/app/actions/projects'

export function DeleteProjectButton({ projectId }: { projectId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  async function handleDelete() {
    setLoading(true)
    const result = await deleteProject(projectId)

    if (result.error) {
      alert(result.error)
      setLoading(false)
      setShowConfirm(false)
    } else {
      router.push('/projects')
    }
  }

  if (showConfirm) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={handleDelete}
          disabled={loading}
          className="px-3 py-1.5 rounded-[8px] text-[12px] font-medium text-white disabled:opacity-50"
          style={{ background: '#ef4444' }}
        >
          {loading ? 'Deleting...' : 'Confirm Delete'}
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          disabled={loading}
          className="px-3 py-1.5 rounded-[8px] text-[12px] text-[rgba(232,236,255,0.6)]"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-[12px] text-[13px] font-medium text-[#ef4444]"
      style={{
        background: 'rgba(239, 68, 68, 0.12)',
        border: '1px solid rgba(239, 68, 68, 0.35)',
      }}
    >
      <Trash2 className="h-4 w-4" />
      Delete
    </button>
  )
}

export function ArchiveProjectButton({ projectId, isActive }: { projectId: string; isActive: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  async function handleArchive() {
    setLoading(true)
    const result = await archiveProject(projectId)

    if (result.error) {
      alert(result.error)
      setLoading(false)
      setShowConfirm(false)
    } else {
      router.refresh()
      setShowConfirm(false)
      setLoading(false)
    }
  }

  if (!isActive) {
    return null
  }

  if (showConfirm) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={handleArchive}
          disabled={loading}
          className="px-3 py-1.5 rounded-[8px] text-[12px] font-medium text-white disabled:opacity-50"
          style={{ background: '#f59e0b' }}
        >
          {loading ? 'Archiving...' : 'Confirm Archive'}
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          disabled={loading}
          className="px-3 py-1.5 rounded-[8px] text-[12px] text-[rgba(232,236,255,0.6)]"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-[12px] text-[13px] font-medium text-[#f59e0b]"
      style={{
        background: 'rgba(245, 158, 11, 0.12)',
        border: '1px solid rgba(245, 158, 11, 0.35)',
      }}
    >
      <Archive className="h-4 w-4" />
      Archive
    </button>
  )
}
