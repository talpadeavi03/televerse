'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, CheckCircle, Loader2, AlertCircle } from 'lucide-react'
import { api } from '@/lib/api'

interface UploadFile {
  file: File
  status: 'pending' | 'uploading' | 'done' | 'error'
  progress: number
  error?: string
}

export function UploadZone({
  onUploadComplete,
  currentFolderId = null,
}: {
  onUploadComplete?: () => void
  currentFolderId?: string | null
}) {
  const [uploads, setUploads] = useState<UploadFile[]>([])

  const updateFile = (name: string, patch: Partial<UploadFile>) => {
    setUploads((prev) => prev.map((u) => (u.file.name === name ? { ...u, ...patch } : u)))
  }

  async function uploadFile(uf: UploadFile) {
    updateFile(uf.file.name, { status: 'uploading', progress: 0 })

    const formData = new FormData()
    formData.append('file', uf.file)
    if (currentFolderId) {
      formData.append('folderId', currentFolderId)
    }

    try {
      await api.upload('/v1/files/upload', formData, (pct) => {
        updateFile(uf.file.name, { progress: pct })
      })
      updateFile(uf.file.name, { status: 'done', progress: 100 })
      onUploadComplete?.()
    } catch (err: unknown) {
      updateFile(uf.file.name, { status: 'error', error: (err as { message?: string })?.message ?? 'Upload failed' })
    }
  }

  const onDrop = useCallback(
    (accepted: File[]) => {
      const newUploads = accepted.map((f) => ({ file: f, status: 'pending' as const, progress: 0 }))
      setUploads((prev) => [...prev, ...newUploads])
      newUploads.forEach((u) => uploadFile(u))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentFolderId],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    maxSize: 2 * 1024 * 1024 * 1024, // 2 GB
  })

  const removeUpload = (name: string) => setUploads((prev) => prev.filter((u) => u.file.name !== name))

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        id="file-upload-trigger"
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
          isDragActive
            ? 'border-brand-500 bg-brand-500/10 scale-[1.02]'
            : 'border-white/20 hover:border-brand-500/50 hover:bg-brand-500/5'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className={`w-8 h-8 mx-auto mb-3 transition-colors ${isDragActive ? 'text-brand-400' : 'text-gray-500'}`} />
        <p className={`font-medium transition-colors ${isDragActive ? 'text-brand-300' : 'text-gray-400'}`}>
          {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
        </p>
        <p className="text-sm text-gray-600 mt-1">or click to browse · Max 2 GB per file</p>
      </div>

      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((u) => (
            <div key={u.file.name} className="glass rounded-lg px-4 py-3 flex items-center gap-3">
              <div className="flex-shrink-0">
                {u.status === 'done' && <CheckCircle className="w-4 h-4 text-green-400" />}
                {u.status === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
                {(u.status === 'uploading' || u.status === 'pending') && (
                  <Loader2 className="w-4 h-4 text-brand-400 animate-spin" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{u.file.name}</p>
                {u.status === 'uploading' && (
                  <div className="mt-1 h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-brand-500 to-purple-500 transition-all duration-300"
                      style={{ width: `${u.progress}%` }}
                    />
                  </div>
                )}
                {u.status === 'error' && <p className="text-xs text-red-400 mt-0.5">{u.error}</p>}
              </div>

              <div className="text-xs text-gray-500">{(u.file.size / 1024 / 1024).toFixed(1)} MB</div>

              {(u.status === 'done' || u.status === 'error') && (
                <button onClick={() => removeUpload(u.file.name)} className="text-gray-500 hover:text-gray-300">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
