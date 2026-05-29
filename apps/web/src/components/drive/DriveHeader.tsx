'use client'

import { Search, Bell, LogOut, User, Menu } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/lib/api'

export function DriveHeader({
  onToggleSidebar,
  isSidebarOpen,
}: {
  onToggleSidebar: () => void
  isSidebarOpen: boolean
}) {
  const [search, setSearch] = useState('')
  const router = useRouter()
  const { user, clearAuth } = useAuthStore()

  async function handleLogout() {
    try { await api.post('/v1/auth/logout', {}) } catch {}
    clearAuth()
    router.push('/auth/login')
  }

  return (
    <header className="flex items-center gap-4 px-6 py-3 border-b border-white/10 bg-surface-50/50 backdrop-blur-sm">
      {/* Sidebar Toggle Hamburger */}
      <button
        onClick={onToggleSidebar}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors mr-1 flex-shrink-0"
        title={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Search */}
      <div className="flex-1 max-w-md relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        <input
          id="drive-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input pl-9"
          placeholder="Search files, folders, AI tags..."
        />
      </div>

      <div className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
          <Bell className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 pl-2 border-l border-white/10">
          <div className="w-8 h-8 rounded-full bg-brand-600/30 flex items-center justify-center">
            <User className="w-4 h-4 text-brand-400" />
          </div>
          <span className="text-sm text-gray-300 hidden md:block">{user?.email}</span>
          <button onClick={handleLogout} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-colors ml-1" title="Log out">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
