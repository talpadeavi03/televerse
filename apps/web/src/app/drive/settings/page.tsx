'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings, User, HardDrive, Shield, AlertTriangle, LogOut, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'

interface UserProfile {
  id: string
  email: string
  plan: 'free' | 'pro'
  storageUsedBytes: string | number
  createdAt: string
}

interface TelegramStatus {
  connected: boolean
  telegramUserId?: string
}

export default function SettingsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [disconnecting, setDisconnecting] = useState(false)
  const [error, setError] = useState('')

  // 1. Fetch User details
  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get<{ data: UserProfile }>('/v1/auth/me'),
  })

  // 2. Fetch Telegram status
  const { data: telegram, isLoading: isTgLoading } = useQuery({
    queryKey: ['telegramStatus'],
    queryFn: () => api.get<{ data: TelegramStatus }>('/v1/telegram/status'),
  })

  // 3. Disconnect Telegram handler
  async function handleDisconnect() {
    if (!confirm('Are you sure you want to disconnect your Telegram account? You will not be able to upload or download files until you link it again.')) {
      return
    }
    
    setDisconnecting(true)
    setError('')
    try {
      await api.delete('/v1/telegram/auth')
      await queryClient.invalidateQueries({ queryKey: ['telegramStatus'] })
      router.push('/drive/connect')
    } catch (err: any) {
      setError(err.message ?? 'Failed to disconnect account')
    } finally {
      setDisconnecting(false)
    }
  }

  // Format bytes helper
  function formatBytes(bytesStr: string | number | undefined): string {
    if (bytesStr === undefined) return '0 B'
    const bytes = typeof bytesStr === 'string' ? parseInt(bytesStr, 10) : bytesStr
    if (isNaN(bytes) || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const loading = isProfileLoading || isTgLoading

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    )
  }

  const user = profile?.data
  const tg = telegram?.data

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center border border-white/10">
          <Settings className="w-5 h-5 text-gray-300" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Profile & Settings</h1>
          <p className="text-xs text-gray-400">Manage your TeleVerse account and Telegram integrations</p>
        </div>
      </div>

      {/* Account Profile Card */}
      <div className="card space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-white/5">
          <User className="w-5 h-5 text-brand-400" />
          <h2 className="font-semibold text-white">Account Information</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span className="block text-xs font-semibold text-gray-500 uppercase">Email Address</span>
            <span className="text-white text-sm font-medium">{user?.email}</span>
          </div>
          <div>
            <span className="block text-xs font-semibold text-gray-500 uppercase">Member Since</span>
            <span className="text-white text-sm font-medium">
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* Telegram Connection Card */}
      <div className="card space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-white/5">
          <Shield className="w-5 h-5 text-brand-400" />
          <h2 className="font-semibold text-white">Telegram Integration</h2>
        </div>

        {tg?.connected ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <div>
                <span className="text-xs font-semibold text-green-400 block">Status: Connected</span>
                <span className="text-white text-sm">Telegram User ID: {tg.telegramUserId}</span>
              </div>
              <button 
                onClick={handleDisconnect} 
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                disabled={disconnecting}
              >
                {disconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                Disconnect
              </button>
            </div>
            {error && <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</div>}
          </div>
        ) : (
          <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex justify-between items-center">
            <div>
              <span className="text-xs font-semibold text-yellow-400 block">Status: Not Connected</span>
              <span className="text-gray-300 text-xs">Link your Telegram account to activate unlimited storage features.</span>
            </div>
            <button 
              onClick={() => router.push('/drive/connect')} 
              className="btn-primary text-xs py-1.5 px-3"
            >
              Connect Now
            </button>
          </div>
        )}
      </div>

      {/* Storage Bar Card */}
      <div className="card space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-white/5">
          <HardDrive className="w-5 h-5 text-brand-400" />
          <h2 className="font-semibold text-white">Storage Capacity</h2>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-gray-300">
            <span>Total Used: {formatBytes(user?.storageUsedBytes)}</span>
            <span className="text-brand-400 font-semibold">Plan: {user?.plan === 'free' ? 'Unlimited Free Storage ✨' : 'Pro'}</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2">
            <div className="bg-brand-500 h-2 rounded-full" style={{ width: '4%' }} />
          </div>
          <p className="text-xs text-gray-500">
            All files are stored in your private Telegram cloud. Your local limit is effectively infinite!
          </p>
        </div>
      </div>

      {/* Security Info */}
      <div className="p-4 bg-yellow-500/5 border border-yellow-500/10 rounded-xl flex gap-3">
        <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-gray-400 space-y-1">
          <span className="font-semibold text-gray-300 block">Security & Privacy Guardrails:</span>
          <p>TeleVerse securely encrypts your connection session keys in our database at-rest using server keys. We never store or mirror your files, nor do we retain your plaintext Telegram passwords.</p>
        </div>
      </div>
    </div>
  )
}
