'use client'

import { Share2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { FileGrid } from '@/components/drive/FileGrid'
import { api } from '@/lib/api'
import type { TeleFile } from '@televerse/types'

export default function SharedPage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['files', 'shared'],
    queryFn: () => api.get<{ data: TeleFile[] }>('/v1/files?shared=true'),
  })

  const files = data?.data ?? []

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20 text-teal-400">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Shared Links & Access</h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage your active public shared files and parameters</p>
          </div>
        </div>

        <Link href="/drive" className="btn-secondary text-xs">
          <ArrowLeft className="w-4 h-4" /> Back to My Drive
        </Link>
      </div>

      {files.length === 0 && !isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <Share2 className="w-12 h-12 mb-3 opacity-30 text-teal-400" />
          <p className="text-lg font-medium text-gray-400">No shared files</p>
          <p className="text-sm mt-1">Files you share publicly will appear here</p>
        </div>
      ) : (
        <FileGrid files={files} loading={isLoading} onRefresh={refetch} />
      )}
    </div>
  )
}
