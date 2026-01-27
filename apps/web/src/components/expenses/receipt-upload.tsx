'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, X, FileText, Image as ImageIcon, Loader2 } from 'lucide-react'

interface ReceiptUploadProps {
  onFileSelect: (_file: File | null) => void
  selectedFile: File | null
  disabled?: boolean
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

export function ReceiptUpload({ onFileSelect, selectedFile, disabled }: ReceiptUploadProps) {
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const validateFile = useCallback((file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP, PDF'
    }
    if (file.size > MAX_SIZE) {
      return 'File too large. Maximum size is 5MB'
    }
    return null
  }, [])

  const handleFile = useCallback(
    (file: File) => {
      const validationError = validateFile(file)
      if (validationError) {
        setError(validationError)
        return
      }

      setError(null)
      onFileSelect(file)

      // Generate preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (e) => {
          setPreview(e.target?.result as string)
        }
        reader.readAsDataURL(file)
      } else {
        setPreview(null)
      }
    },
    [validateFile, onFileSelect]
  )

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)

      if (disabled) return

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFile(e.dataTransfer.files[0])
      }
    },
    [disabled, handleFile]
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      e.preventDefault()
      if (e.target.files && e.target.files[0]) {
        handleFile(e.target.files[0])
      }
    },
    [handleFile]
  )

  const removeFile = useCallback(() => {
    onFileSelect(null)
    setPreview(null)
    setError(null)
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }, [onFileSelect])

  const inputStyle = {
    background: 'rgba(0, 0, 0, 0.25)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
  }

  if (selectedFile) {
    const isPdf = selectedFile.type === 'application/pdf'
    const Icon = isPdf ? FileText : ImageIcon

    return (
      <div className="space-y-2">
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-[rgba(232,236,255,0.68)]">
          Receipt / Attachment
        </label>
        <div className="rounded-[12px] p-4" style={inputStyle}>
          <div className="flex items-center gap-3">
            {preview ? (
              <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Preview" className="h-full w-full object-cover" />
              </div>
            ) : (
              <div
                className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg"
                style={{ background: 'rgba(255, 255, 255, 0.08)' }}
              >
                <Icon className="h-8 w-8 text-[rgba(232,236,255,0.5)]" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] text-white">{selectedFile.name}</p>
              <p className="text-[11px] text-[rgba(232,236,255,0.5)]">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
            {!disabled && (
              <button
                type="button"
                onClick={removeFile}
                className="rounded-lg p-2 transition-colors hover:bg-[rgba(255,255,255,0.1)]"
              >
                <X className="h-4 w-4 text-[rgba(232,236,255,0.5)]" />
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <label className="block text-[11px] font-semibold uppercase tracking-wide text-[rgba(232,236,255,0.68)]">
        Receipt / Attachment (optional)
      </label>
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`cursor-pointer rounded-[12px] p-6 text-center transition-all ${
          dragActive ? 'ring-2 ring-[#1f5bff]' : ''
        } ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-[rgba(255,255,255,0.02)]'}`}
        style={{
          ...inputStyle,
          borderStyle: 'dashed',
          background: dragActive ? 'rgba(31, 91, 255, 0.1)' : 'rgba(0, 0, 0, 0.25)',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_TYPES.join(',')}
          onChange={handleChange}
          disabled={disabled}
          className="hidden"
        />
        <Upload className="mx-auto mb-2 h-8 w-8 text-[rgba(232,236,255,0.4)]" />
        <p className="text-[13px] text-[rgba(232,236,255,0.7)]">
          <span className="text-[#1f5bff]">Click to upload</span> or drag and drop
        </p>
        <p className="mt-1 text-[11px] text-[rgba(232,236,255,0.4)]">
          JPEG, PNG, GIF, WebP, or PDF (max 5MB)
        </p>
      </div>
      {error && <p className="text-[12px] text-[#ef4444]">{error}</p>}
    </div>
  )
}

interface ReceiptUploadingProps {
  fileName: string
}

export function ReceiptUploading({ fileName }: ReceiptUploadingProps) {
  return (
    <div className="space-y-2">
      <label className="block text-[11px] font-semibold uppercase tracking-wide text-[rgba(232,236,255,0.68)]">
        Receipt / Attachment
      </label>
      <div
        className="rounded-[12px] p-4"
        style={{
          background: 'rgba(0, 0, 0, 0.25)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ background: 'rgba(31, 91, 255, 0.15)' }}
          >
            <Loader2 className="h-5 w-5 animate-spin text-[#1f5bff]" />
          </div>
          <div className="flex-1">
            <p className="text-[13px] text-white">Uploading receipt...</p>
            <p className="text-[11px] text-[rgba(232,236,255,0.5)]">{fileName}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
