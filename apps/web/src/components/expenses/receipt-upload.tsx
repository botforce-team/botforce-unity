'use client'

import { useState, useRef } from 'react'
import { Upload, X, FileImage, File, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui'
import { uploadReceipt } from '@/app/actions/expenses'
import { useToast } from '@/components/ui/use-toast'

interface ReceiptUploadProps {
  expenseId: string
  existingReceipt?: string | null
  onUploadComplete?: (url: string) => void
}

export function ReceiptUpload({ expenseId, existingReceipt, onUploadComplete }: ReceiptUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(existingReceipt || null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleFile = async (file: File) => {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a JPEG, PNG, WebP, or PDF file',
        variant: 'destructive',
      })
      return
    }

    // Validate file size
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Maximum file size is 10MB',
        variant: 'destructive',
      })
      return
    }

    setIsUploading(true)

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => setPreview(e.target?.result as string)
      reader.readAsDataURL(file)
    } else {
      setPreview('pdf')
    }

    try {
      const formData = new FormData()
      formData.append('file', file)

      const result = await uploadReceipt(expenseId, formData)

      if (result.success) {
        toast({
          title: 'Receipt uploaded',
          description: 'Your receipt has been attached to the expense',
        })
        onUploadComplete?.(result.data!.url)
      } else {
        toast({
          title: 'Upload failed',
          description: result.error || 'Please try again',
          variant: 'destructive',
        })
        setPreview(existingReceipt || null)
      }
    } catch {
      toast({
        title: 'Upload error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      })
      setPreview(existingReceipt || null)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files?.[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleFile(e.target.files[0])
    }
  }

  const handleRemove = () => {
    setPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={handleChange}
        className="hidden"
        disabled={isUploading}
      />

      {preview ? (
        <div className="relative rounded-lg border border-border bg-surface p-2">
          {preview === 'pdf' ? (
            <div className="flex items-center gap-3 p-2">
              <File className="h-10 w-10 text-red-500" />
              <span className="text-sm">PDF Receipt</span>
            </div>
          ) : (
            <img
              src={preview}
              alt="Receipt preview"
              className="max-h-48 w-full rounded object-contain"
            />
          )}
          {!isUploading && (
            <button
              type="button"
              onClick={handleRemove}
              className="absolute right-2 top-2 rounded-full bg-background/80 p-1 hover:bg-background"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/80">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
        </div>
      ) : (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
            dragActive
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50 hover:bg-surface'
          }`}
          onClick={() => fileInputRef.current?.click()}
        >
          {isUploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          ) : (
            <>
              <Upload className="mb-2 h-8 w-8 text-text-muted" />
              <p className="text-sm text-text-secondary">
                Drop receipt here or click to upload
              </p>
              <p className="mt-1 text-xs text-text-muted">
                JPEG, PNG, WebP, or PDF (max 10MB)
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
