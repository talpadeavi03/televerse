'use client'

import { Download, Trash2, Share2, MoreVertical, FileText, Image, Video, Music, Package, FileCode, FileIcon, Loader2, RotateCcw, Star, FolderPlus, FilePlus, ChevronRight, Folder, Edit3, Save, X, ArrowLeft, ArrowUp, ArrowDown } from 'lucide-react'
import { useState } from 'react'
import type { TeleFile, Folder as TeleFolder } from '@televerse/types'
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
  folders = [],
  loading,
  onRefresh,
  isTrashView = false,
  currentFolderId = null,
  setCurrentFolderId = () => {},
  breadcrumbs = [],
  setBreadcrumbs = () => {},
}: {
  files: TeleFile[]
  folders?: TeleFolder[]
  loading: boolean
  onRefresh: () => void
  isTrashView?: boolean
  currentFolderId?: string | null
  setCurrentFolderId?: (id: string | null) => void
  breadcrumbs?: { id: string; name: string }[]
  setBreadcrumbs?: (crumbs: { id: string; name: string }[]) => void
}) {
  const [deleting, setDeleting] = useState<string | null>(null)
  const [starring, setStarring] = useState<string | null>(null)

  // Local interactive sorting states
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'date'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Folder & File Creation states
  const [showFolderModal, setShowFolderModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [showFileModal, setShowFileModal] = useState(false)
  const [newFileName, setNewFileName] = useState('')

  // Text File Editor states
  const [editingFile, setEditingFile] = useState<TeleFile | null>(null)
  const [editorContent, setEditorContent] = useState('')
  const [isLoadingEditor, setIsLoadingEditor] = useState(false)
  const [isSavingEditor, setIsSavingEditor] = useState(false)

  // Handler: Delete File
  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      await api.delete(`/v1/files/${id}`)
      onRefresh()
    } finally {
      setDeleting(null)
    }
  }

  // Handler: Delete Folder
  async function handleDeleteFolder(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Are you sure you want to delete this folder? Files inside will be detached.')) {
      return
    }
    setDeleting(id)
    try {
      await api.delete(`/v1/folders/${id}`)
      onRefresh()
    } finally {
      setDeleting(null)
    }
  }

  // Handler: Restore File
  async function handleRestore(id: string) {
    try {
      await api.patch(`/v1/files/${id}/restore`, {})
      onRefresh()
    } catch (e) {
      console.error(e)
    }
  }

  // Handler: Permanent Purge
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

  // Handler: Star Toggle
  async function handleStarToggle(id: string) {
    setStarring(id)
    try {
      await api.patch(`/v1/files/${id}/star`, {})
      onRefresh()
    } finally {
      setStarring(null)
    }
  }

  // Handler: Download
  async function handleDownload(file: TeleFile) {
    const { accessToken } = useAuthStore.getState()
    const a = document.createElement('a')
    a.href = `${BASE_URL}/v1/files/${file.id}/download?token=${accessToken}`
    a.download = file.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // Handler: Create Folder
  async function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault()
    if (!newFolderName.trim()) return
    try {
      await api.post('/v1/folders', {
        name: newFolderName,
        parentId: currentFolderId || undefined,
      })
      setNewFolderName('')
      setShowFolderModal(false)
      onRefresh()
    } catch (err) {
      console.error(err)
    }
  }

  // Handler: Create Empty File
  async function handleCreateEmptyFile(e: React.FormEvent) {
    e.preventDefault()
    if (!newFileName.trim()) return
    try {
      // 1-character file containing newline for Telegram stream integrity
      const fileObj = new File(['\n'], newFileName.includes('.') ? newFileName : `${newFileName}.txt`, { type: 'text/plain' })
      const formData = new FormData()
      formData.append('file', fileObj)
      if (currentFolderId) {
        formData.append('folderId', currentFolderId)
      }
      await api.post('/v1/files/upload', formData)
      setNewFileName('')
      setShowFileModal(false)
      onRefresh()
    } catch (err) {
      console.error(err)
    }
  }

  // Handler: Start Text File Editing
  async function handleEditStart(file: TeleFile) {
    setEditingFile(file)
    setIsLoadingEditor(true)
    try {
      const { accessToken } = useAuthStore.getState()
      const response = await fetch(`${BASE_URL}/v1/files/${file.id}/download?token=${accessToken}`)
      const text = await response.text()
      setEditorContent(text)
    } catch (err) {
      console.error('Failed to load text file content:', err)
      alert('Failed to load text file content.')
      setEditingFile(null)
    } finally {
      setIsLoadingEditor(false)
    }
  }

  // Handler: Save Text File Changes
  async function handleEditSave() {
    if (!editingFile) return
    setIsSavingEditor(true)
    try {
      // 1. Upload new version to Telegram & insert in DB
      const fileBlob = new File([editorContent], editingFile.name, { type: editingFile.mimeType || 'text/plain' })
      const formData = new FormData()
      formData.append('file', fileBlob)
      if (currentFolderId) {
        formData.append('folderId', currentFolderId)
      }
      await api.post('/v1/files/upload', formData)

      // 2. Permanently delete old version from DB & Telegram messages
      await api.delete(`/v1/files/${editingFile.id}/purge`)

      setEditingFile(null)
      onRefresh()
    } catch (err) {
      console.error('Failed to save file changes:', err)
      alert('Failed to save changes.')
    } finally {
      setIsSavingEditor(false)
    }
  }

  // Breadcrumbs click handler
  const handleBreadcrumbClick = (id: string | null, idx: number) => {
    setCurrentFolderId(id)
    if (id === null) {
      setBreadcrumbs([])
    } else {
      setBreadcrumbs(breadcrumbs.slice(0, idx + 1))
    }
  }

  // Check if file is editable text
  const isEditable = (file: TeleFile) => {
    if (!file.mimeType) return false
    return (
      file.mimeType.startsWith('text/') ||
      file.mimeType.includes('json') ||
      file.mimeType.includes('javascript') ||
      file.mimeType.includes('typescript') ||
      file.mimeType.includes('html') ||
      file.mimeType.includes('css')
    )
  }

  // Header click handler for sorting
  const handleHeaderClick = (column: 'name' | 'size' | 'date') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder(column === 'name' ? 'asc' : 'desc')
    }
  }

  // Local dynamic sorting algorithm (Keep folders on top, then sort folders and files separately)
  const sortedFolders = [...folders].sort((a, b) => a.name.localeCompare(b.name))
  const sortedFiles = [...files].sort((a, b) => {
    let comparison = 0
    if (sortBy === 'name') {
      comparison = a.name.localeCompare(b.name)
    } else if (sortBy === 'size') {
      comparison = Number(a.sizeBytes - b.sizeBytes)
    } else if (sortBy === 'date') {
      comparison = new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime()
    }
    return sortOrder === 'asc' ? comparison : -comparison
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Dynamic Creation Toolbar & Breadcrumbs (Only shown in active views) */}
      {!isTrashView && (setCurrentFolderId as any) !== undefined && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border border-white/10 bg-surface-100/50 backdrop-blur-md">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1 text-sm font-medium">
            <button
              onClick={() => handleBreadcrumbClick(null, -1)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              My Drive
            </button>
            {breadcrumbs.map((crumb, idx) => (
              <div key={crumb.id} className="flex items-center gap-1">
                <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                <button
                  onClick={() => handleBreadcrumbClick(crumb.id, idx)}
                  className={`hover:text-white transition-colors ${
                    idx === breadcrumbs.length - 1 ? 'text-brand-400 font-bold' : 'text-gray-400'
                  }`}
                >
                  {crumb.name}
                </button>
              </div>
            ))}
          </div>

          {/* Creation Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFolderModal(true)}
              className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-1.5"
              title="Create New Directory"
            >
              <FolderPlus className="w-4 h-4 text-brand-400" />
              <span>Create Folder</span>
            </button>
            <button
              onClick={() => setShowFileModal(true)}
              className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-1.5"
              title="Create Empty Text Note"
            >
              <FilePlus className="w-4 h-4 text-emerald-400" />
              <span>Create File</span>
            </button>
          </div>
        </div>
      )}

      {/* Directory Content Listing */}
      {sortedFolders.length === 0 && sortedFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <FileIcon className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-lg font-medium text-gray-400">No folders or files here</p>
          <p className="text-sm mt-1">Create a folder or drop files to get started</p>
        </div>
      ) : (
        <div>
          {/* Table Clickable Sort Headers */}
          <div className="grid grid-cols-12 gap-4 px-4 py-2.5 text-xs text-gray-500 uppercase tracking-wide font-semibold border-b border-white/10 mb-1 select-none">
            <div
              className="col-span-6 flex items-center gap-1 cursor-pointer hover:text-white transition-colors"
              onClick={() => handleHeaderClick('name')}
            >
              <span>Name</span>
              {sortBy === 'name' && (
                sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-brand-400" /> : <ArrowDown className="w-3 h-3 text-brand-400" />
              )}
            </div>
            <div
              className="col-span-2 text-right flex items-center justify-end gap-1 cursor-pointer hover:text-white transition-colors"
              onClick={() => handleHeaderClick('size')}
            >
              <span>Size</span>
              {sortBy === 'size' && (
                sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-brand-400" /> : <ArrowDown className="w-3 h-3 text-brand-400" />
              )}
            </div>
            <div
              className="col-span-2 text-right flex items-center justify-end gap-1 cursor-pointer hover:text-white transition-colors"
              onClick={() => handleHeaderClick('date')}
            >
              <span>Modified</span>
              {sortBy === 'date' && (
                sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-brand-400" /> : <ArrowDown className="w-3 h-3 text-brand-400" />
              )}
            </div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          <div className="space-y-0.5">
            {/* 1. Render Virtual Folder Rows */}
            {sortedFolders.map((folder) => (
              <div
                key={folder.id}
                onClick={() => {
                  setCurrentFolderId(folder.id)
                  setBreadcrumbs([...breadcrumbs, { id: folder.id, name: folder.name }])
                }}
                className="file-row group grid grid-cols-12 gap-4 px-4 py-3 rounded-lg hover:bg-white/[0.03] transition-colors duration-150 cursor-pointer items-center border border-transparent hover:border-white/5"
              >
                <div className="col-span-6 flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-purple-600/10 flex items-center justify-center flex-shrink-0">
                    <Folder className="w-4 h-4 text-purple-400 fill-purple-400/20" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-white font-semibold truncate">{folder.name}</p>
                    <p className="text-xs text-gray-500">Virtual Directory</p>
                  </div>
                </div>

                <div className="col-span-2 flex items-center justify-end text-sm text-gray-500">—</div>

                <div className="col-span-2 flex items-center justify-end text-sm text-gray-500">
                  <TimeAgo date={folder.createdAt} />
                </div>

                {/* Folder Actions */}
                <div className="col-span-2 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => handleDeleteFolder(folder.id, e)}
                    disabled={deleting === folder.id}
                    className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                    title="Delete Directory"
                  >
                    {deleting === folder.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))}

            {/* 2. Render File Rows */}
            {sortedFiles.map((file) => {
              const Icon = getIcon(file.mimeType)
              return (
                <div key={file.id} className="file-row group grid grid-cols-12 gap-4 px-4 items-center">
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
                  <div className="col-span-2 flex items-center justify-end text-sm text-gray-400 font-mono">
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
                          className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-green-400 hover:bg-green-400/10 transition-colors"
                          title="Restore File"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handlePurge(file.id)}
                          disabled={deleting === file.id}
                          className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
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
                          className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                          title="Download File"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        {/* Text File Edit Trigger */}
                        {isEditable(file) && (
                          <button
                            onClick={() => handleEditStart(file)}
                            className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                            title="Edit File Content"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => handleStarToggle(file.id)}
                          disabled={starring === file.id}
                          className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
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
                          className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                          title="Share Link"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(file.id)}
                          disabled={deleting === file.id}
                          className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
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
      )}

      {/* Creation Modal: Folder */}
      {showFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <form
            onSubmit={handleCreateFolder}
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-surface-100/90 backdrop-blur-xl p-5 space-y-4 shadow-2xl animate-scale-up"
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <FolderPlus className="w-4 h-4 text-brand-400" />
                <span>Create New Folder</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowFolderModal(false)}
                className="text-gray-500 hover:text-white p-0.5 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="folderName" className="text-xs text-gray-400">Directory Name</label>
              <input
                id="folderName"
                type="text"
                autoFocus
                placeholder="Documents, Images, Project A..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="input text-sm w-full"
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowFolderModal(false)}
                className="btn-secondary text-xs px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary text-xs px-4 py-1.5"
              >
                Create Folder
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Creation Modal: Empty File */}
      {showFileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <form
            onSubmit={handleCreateEmptyFile}
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-surface-100/90 backdrop-blur-xl p-5 space-y-4 shadow-2xl animate-scale-up"
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <FilePlus className="w-4 h-4 text-emerald-400" />
                <span>Create New Text File</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowFileModal(false)}
                className="text-gray-500 hover:text-white p-0.5 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="fileName" className="text-xs text-gray-400">Filename</label>
              <input
                id="fileName"
                type="text"
                autoFocus
                placeholder="note.txt, script.js, index.html..."
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                className="input text-sm w-full"
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowFileModal(false)}
                className="btn-secondary text-xs px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary text-xs px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500"
              >
                Create File
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Premium Glassmorphic Text Editor Drawer / Modal */}
      {editingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 md:p-8 animate-fade-in">
          <div className="w-full max-w-3xl h-[85vh] rounded-2xl border border-white/10 bg-surface-100/95 backdrop-blur-xl flex flex-col shadow-2xl overflow-hidden animate-scale-up">
            {/* Editor Header */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white leading-none">{editingFile.name}</h3>
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">{editingFile.mimeType}</span>
                </div>
              </div>
              <button
                onClick={() => setEditingFile(null)}
                className="text-gray-500 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Editor Body */}
            <div className="flex-1 p-4 bg-black/30 overflow-hidden relative">
              {isLoadingEditor ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
                  <span className="text-xs">Streaming file contents...</span>
                </div>
              ) : (
                <textarea
                  value={editorContent}
                  onChange={(e) => setEditorContent(e.target.value)}
                  className="w-full h-full bg-transparent border-0 outline-none text-sm text-gray-300 font-mono resize-none leading-relaxed p-2"
                  placeholder="Type text contents here..."
                />
              )}
            </div>

            {/* Editor Footer */}
            <div className="px-6 py-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-between">
              <span className="text-[10px] text-gray-500">
                Size: {formatBytes(editorContent.length)} · Encoding: UTF-8
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setEditingFile(null)}
                  className="btn-secondary text-xs px-4 py-2"
                  disabled={isSavingEditor}
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditSave}
                  className="btn-primary text-xs px-5 py-2 flex items-center gap-1.5"
                  disabled={isSavingEditor || isLoadingEditor}
                >
                  {isSavingEditor ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving changes...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
