'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { FileGrid } from '@/components/drive/FileGrid'
import { UploadZone } from '@/components/drive/UploadZone'
import { StorageBar } from '@/components/drive/StorageBar'
import { AssociationMap } from '@/components/drive/AssociationMap'
import { api } from '@/lib/api'
import type { TeleFile } from '@televerse/types'

export default function DrivePage() {
  const router = useRouter()

  // 1. Query Telegram link connection status
  const { data: statusData, isLoading: isStatusLoading } = useQuery({
    queryKey: ['telegramStatus'],
    queryFn: () => api.get<{ data: { connected: boolean } }>('/v1/telegram/status'),
  })

  // 2. Redirect to connection screen if not connected
  useEffect(() => {
    if (!isStatusLoading && statusData && !statusData.data.connected) {
      router.replace('/drive/connect')
    }
  }, [statusData, isStatusLoading, router])

  // 3. Query files
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['files', null],
    queryFn: () => api.get<{ data: TeleFile[]; meta: { total: number } }>('/v1/files'),
    enabled: statusData?.data.connected === true, // Only fetch files if connected
  })

  if (isStatusLoading || (statusData && !statusData.data.connected)) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-gray-400 animate-pulse">Checking Telegram session state...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <StorageBar />
      {statusData?.data.connected && <AssociationMap />}
      <UploadZone onUploadComplete={refetch} />
      <FileGrid files={data?.data ?? []} loading={isLoading} onRefresh={refetch} />
    </div>
  )
}
