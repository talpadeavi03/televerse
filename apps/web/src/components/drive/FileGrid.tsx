'use client'

import { Download, Trash2, Share2, MoreVertical, FileText, Image, Video, Music, Package, FileCode, FileIcon, Loader2, RotateCcw, Star } from 'lucide-react'
import { useState } from 'react'
import type { TeleFile } from '@televerse/types'
import { api, BASE_URL } from '@/lib/api'
import { formatBytes } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'

const MIME_ICONS: Record<string, typeof FileIcon> = {
  'image/': Image,
  'video/': Video,
  'audio/': Music,
  'application/pdf': FileText,
  'application/zip': Package,
  'text/': FileCode,
}

function getIcon(mimeType: string | null): typeof FileIcon {
  if (!mimeType) return FileIcon
  for (const [prefix, Icon] of Object.entries(MIME_ICONS)) {
    if (mimeType.startsWith(prefix)) return Icon
  }
  return FileIcon
}

function TimeAgo({ date }: { date: string | Date }) {
  const d = new Date(date)
  const now = Date.now()
  const diff = (now - d.getTime()) / 1000
  if (diff < 60) return <span>Just now</span>
  if (diff < 3600) return <span>{Math.floor(diff / 60)}m ago</span>
  if (diff < 86400) return <span>{Math.floor(diff / 3600)}h ago</span>
  return <span>{d.toLocaleDateString()}</span>
}

export function FileGrid({
  files,
  loading,
  onRefresh,
  isTrashView = false,
}: {
  files: TeleFile[]
  loading: boolean
  onRefresh: () => void
  isTrashView?: boolean
}) {
  const [deleting, setDeleting] = useState<string | null>(null)
  const [starring, setStarring] = useState<string | null>(null)

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      await api.delete(`/v1/files/${id}`)
      onRefresh()
    } finally {
      setDeleting(null)
    }
  }

  async function handleRestore(id: string) {
    try {
      await api.patch(`/v1/files/${id}/restore`, {})
      onRefresh()
    } catch (e) {
      console.error(e)
    }
  }

  async function handlePurge(id: string) {
    if (!confirm('Are you sure you want to permanently delete this file from both TeleVerse and Telegram? This cannot be undone.')) {
      return
    }
    setDeleting(id)
    try {
      await api.delete(`/v1/files/${id}/purge`)
      onRefresh()
    } finally {
      setDeleting(null)
    }
  }

  async function handleStarToggle(id: string) {
    setStarring(id)
    try {
      await api.patch(`/v1/files/${id}/star`, {})
      onRefresh()
    } finally {
      setStarring(null)
    }
  }

  async function handleDownload(file: TeleFile) {
    const { accessToken } = useAuthStore.getState()
    const a = document.createElement('a')
    a.href = `${BASE_URL}/v1/files/${file.id}/download?token=${accessToken}`
    a.download = file.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <FileIcon className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-lg font-medium text-gray-400">No files yet</p>
        <p className="text-sm mt-1">Upload files using the area above</p>
      </div>
    )
  }

  return (
    <div>
      {/* Table header */}
      <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs text-gray-500 uppercase tracking-wide font-medium border-b border-white/10 mb-1">
        <div className="col-span-6">Name</div>
        <div className="col-span-2 text-right">Size</div>
        <div className="col-span-2 text-right">Modified</div>
        <div className="col-span-2 text-right">Actions</div>
      </div>

      <div className="space-y-0.5">
        {files.map((file) => {
          const Icon = getIcon(file.mimeType)
          return (
            <div key={file.id} className="file-row group grid grid-cols-12 gap-4 px-4">
              {/* Name */}
              <div className="col-span-6 flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-brand-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-white font-medium truncate">{file.name}</p>
                  {file.mimeType && <p className="text-xs text-gray-500 truncate">{file.mimeType}</p>}
                </div>
              </div>

              {/* Size */}
              <div className="col-span-2 flex items-center justify-end text-sm text-gray-400">
                {formatBytes(file.sizeBytes)}
              </div>

              {/* Date */}
              <div className="col-span-2 flex items-center justify-end text-sm text-gray-500">
                <TimeAgo date={file.uploadedAt} />
              </div>

              {/* Actions */}
              <div className="col-span-2 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {isTrashView ? (
                  <>
                    <button
                      onClick={() => handleRestore(file.id)}
                      className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-green-400 hover:bg-green-400/10"
                      title="Restore File"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handlePurge(file.id)}
                      disabled={deleting === file.id}
                      className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-red-400 hover:bg-red-400/10"
                      title="Delete Permanently"
                    >
                      {deleting === file.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleDownload(file)}
                      className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-white/10"
                      title="Download"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleStarToggle(file.id)}
                      disabled={starring === file.id}
                      className={`w-7 h-7 flex items-center justify-center rounded ${
                        file.isStarred
                          ? 'text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/10'
                          : 'text-gray-400 hover:text-white hover:bg-white/10'
                      }`}
                      title={file.isStarred ? 'Unstar file' : 'Star file'}
                    >
                      {starring === file.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Star className={`w-3.5 h-3.5 ${file.isStarred ? 'fill-yellow-400' : ''}`} />
                      )}
                    </button>
                    <button
                      className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-white/10"
                      title="Share"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(file.id)}
                      disabled={deleting === file.id}
                      className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-red-400 hover:bg-red-400/10"
                      title="Move to Trash"
                    >
                      {deleting === file.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
