'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MoreHorizontal, Pencil, Trash2, Eye, Power, PowerOff, Users, Clock } from 'lucide-react'
import { Button } from '@/components/ui'
import { deleteProject, toggleProjectActive } from '@/app/actions/projects'
import type { Project } from '@/types'

interface ProjectActionsProps {
  project: Project
}

export function ProjectActions({ project }: ProjectActionsProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleToggleActive = () => {
    startTransition(async () => {
      const result = await toggleProjectActive(project.id, !project.is_active)
      if (!result.success) {
        alert(result.error)
      }
      setIsOpen(false)
    })
  }

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteProject(project.id)
      if (!result.success) {
        alert(result.error)
      }
      setShowDeleteConfirm(false)
      setIsOpen(false)
    })
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isPending}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setIsOpen(false)
              setShowDeleteConfirm(false)
            }}
          />
          <div className="absolute right-0 z-50 mt-1 w-48 rounded-md border border-border bg-surface shadow-lg">
            {showDeleteConfirm ? (
              <div className="p-3">
                <p className="text-sm text-text-primary mb-3">Delete this project?</p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleDelete}
                    disabled={isPending}
                  >
                    {isPending ? 'Deleting...' : 'Delete'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="py-1">
                <Link
                  href={`/projects/${project.id}`}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-hover"
                  onClick={() => setIsOpen(false)}
                >
                  <Eye className="h-4 w-4" />
                  View Details
                </Link>
                <Link
                  href={`/projects/${project.id}/edit`}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-hover"
                  onClick={() => setIsOpen(false)}
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </Link>
                <Link
                  href={`/timesheets/new?project=${project.id}`}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-hover"
                  onClick={() => setIsOpen(false)}
                >
                  <Clock className="h-4 w-4" />
                  Log Time
                </Link>
                <button
                  onClick={handleToggleActive}
                  disabled={isPending}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-hover disabled:opacity-50"
                >
                  {project.is_active ? (
                    <>
                      <PowerOff className="h-4 w-4" />
                      Deactivate
                    </>
                  ) : (
                    <>
                      <Power className="h-4 w-4" />
                      Activate
                    </>
                  )}
                </button>
                <hr className="my-1 border-border" />
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-surface-hover"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
