'use client'

import { useQuery } from '@tanstack/react-query'
import { FileGrid } from '@/components/drive/FileGrid'
import { UploadZone } from '@/components/drive/UploadZone'
import { StorageBar } from '@/components/drive/StorageBar'
import { api } from '@/lib/api'
import type { TeleFile } from '@televerse/types'

export default function DrivePage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['files', null],
    queryFn: () => api.get<{ data: TeleFile[]; meta: { total: number } }>('/v1/files'),
  })

  return (
    <div className="space-y-6 animate-fade-in">
      <StorageBar />
      <UploadZone onUploadComplete={refetch} />
      <FileGrid files={data?.data ?? []} loading={isLoading} onRefresh={refetch} />
    </div>
  )
}
