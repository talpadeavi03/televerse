'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, CheckCircle, Loader2, AlertCircle } from 'lucide-react'
import { api } from '@/lib/api'

interface UploadFile {
  file: File
  fileId?: string
  jobId?: string
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

  async function pollStatus(name: string, fileId: string) {
    const MAX_POLLS = 120 // 120 × 3s = 6 minutes max wait
    let polls = 0
    while (polls < MAX_POLLS) {
      await new Promise((r) => setTimeout(r, 3000))
      polls++
      try {
        const res = await api.get<{ data: { uploadStatus: string; progress: number | null } }>(`/v1/files/${fileId}/status`)
        const { uploadStatus, progress } = res.data
        if (uploadStatus === 'done') {
          updateFile(name, { status: 'done', progress: 100 })
          onUploadComplete?.()
          return
        }
        if (uploadStatus === 'failed') {
          updateFile(name, { status: 'error', error: 'Upload to Telegram failed — will retry automatically' })
          return
        }
        if (uploadStatus === 'uploading' && progress !== null) {
          updateFile(name, { status: 'uploading', progress })
        }
      } catch { /* network blip, keep polling */ }
    }
    updateFile(name, { status: 'error', error: 'Upload timed out' })
  }

  async function uploadFile(uf: UploadFile) {
    updateFile(uf.file.name, { status: 'uploading', progress: 0 })

    const formData = new FormData()
    formData.append('file', uf.file)
    if (currentFolderId) formData.append('folderId', currentFolderId)

    try {
      const res = await api.upload<{ data: { id: string }; jobId: string }>('/v1/files/upload', formData, (pct) => {
        updateFile(uf.file.name, { progress: pct })
      })

      // 202: queued — start polling status
      const fileId = res.data.id
      updateFile(uf.file.name, { fileId, jobId: res.jobId, status: 'uploading', progress: 1 })
      pollStatus(uf.file.name, fileId)
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
        className={`border-2 border-dashed rounded-xl p-3 flex flex-col justify-center text-center cursor-pointer transition-all duration-200 h-full min-h-[96px] ${
          isDragActive
            ? 'border-brand-500 bg-brand-500/10 scale-[1.01]'
            : 'border-white/20 hover:border-brand-500/50 hover:bg-brand-500/5'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className={`w-5 h-5 mx-auto mb-1.5 transition-colors ${isDragActive ? 'text-brand-400' : 'text-gray-500'}`} />
        <p className={`text-xs font-semibold transition-colors ${isDragActive ? 'text-brand-300' : 'text-gray-400'}`}>
          {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
        </p>
        <p className="text-[10px] text-gray-600 mt-0.5">or click to browse · Max 2 GB per file</p>
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
