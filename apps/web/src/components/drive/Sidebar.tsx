'use client'

import { Cloud, HardDrive, Star, Trash2, Share2, Settings, Plus, FolderPlus } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

const NAV_ITEMS = [
  { icon: HardDrive, label: 'My Drive', href: '/drive' },
  { icon: Share2, label: 'Shared', href: '/drive/shared' },
  { icon: Star, label: 'Starred', href: '/drive/starred' },
  { icon: Trash2, label: 'Trash', href: '/drive/trash' },
]

export function Sidebar({
  isOpen,
  setIsOpen,
}: {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
}) {
  const pathname = usePathname()
  const { data } = useQuery({
    queryKey: ['folders'],
    queryFn: () => api.get<{ data: { id: string; name: string; icon?: string; color?: string }[] }>('/v1/folders'),
  })

  return (
    <aside className={`flex-shrink-0 border-r border-white/10 bg-surface-50 flex flex-col transition-all duration-300 ${
      isOpen ? 'w-60 opacity-100' : 'w-0 opacity-0 -translate-x-full border-r-0 overflow-hidden'
    }`}>
      {/* Logo */}
      <div className="px-4 py-5 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center">
          <Cloud className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold text-lg text-gradient">TeleVerse</span>
      </div>

      {/* New upload button */}
      <div className="px-3 mb-4">
        <button className="btn-primary w-full justify-center" onClick={() => document.getElementById('file-upload-trigger')?.click()}>
          <Plus className="w-4 h-4" /> Upload Files
        </button>
      </div>

      {/* Nav */}
      <nav className="px-3 space-y-0.5 flex-1 overflow-auto">
        {NAV_ITEMS.map(({ icon: Icon, label, href }) => (
          <Link key={href} href={href} className={`sidebar-item ${pathname === href ? 'active' : ''}`}>
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        ))}

        {/* Folders */}
        <div className="pt-4">
          <div className="flex items-center justify-between px-3 mb-1">
            <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Folders</span>
            <button className="text-gray-500 hover:text-gray-300 p-0.5 rounded" title="New folder">
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
          </div>
          {data?.data.map((folder) => (
            <Link key={folder.id} href={`/drive/folder/${folder.id}`} className={`sidebar-item ${pathname === `/drive/folder/${folder.id}` ? 'active' : ''}`}>
              <span className="text-base">{folder.icon ?? '📁'}</span>
              <span className="truncate">{folder.name}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* Settings */}
      <div className="px-3 pb-4 border-t border-white/10 pt-3">
        <Link href="/drive/settings" className="sidebar-item">
          <Settings className="w-4 h-4" />
          Settings
        </Link>
      </div>
    </aside>
  )
}
