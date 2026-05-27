'use client'

import { useQuery } from '@tanstack/react-query'
import { HardDrive } from 'lucide-react'
import { api } from '@/lib/api'

interface StorageData {
  data: {
    usedBytes: number
    usedFormatted: string
    plan: string
  }
}

export function StorageBar() {
  const { data } = useQuery({
    queryKey: ['storage'],
    queryFn: () => api.get<StorageData>('/v1/storage/usage'),
    refetchInterval: 60000,
  })

  const used = data?.data.usedBytes ?? 0
  const formatted = data?.data.usedFormatted ?? '0 B'

  return (
    <div className="glass rounded-xl p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-brand-600/20 flex items-center justify-center flex-shrink-0">
        <HardDrive className="w-5 h-5 text-brand-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-gray-300">Storage Used</span>
          <span className="text-sm text-gray-400">{formatted}</span>
        </div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand-500 to-purple-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.min((used / (2 * 1024 * 1024 * 1024)) * 100, 100)}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Unlimited via Telegram · {data?.data.plan === 'pro' ? 'Pro Plan' : 'Free Plan'}
        </p>
      </div>
    </div>
  )
}
