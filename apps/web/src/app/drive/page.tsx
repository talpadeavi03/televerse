'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { FileGrid } from '@/components/drive/FileGrid'
import { UploadZone } from '@/components/drive/UploadZone'
import { StorageBar } from '@/components/drive/StorageBar'
import { AssociationMap } from '@/components/drive/AssociationMap'
import { api } from '@/lib/api'
import type { TeleFile, Folder } from '@televerse/types'

export default function DrivePage() {
  const router = useRouter()
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string; name: string }[]>([])

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

  // 3. Query folders in current directory
  const { data: foldersData, isLoading: isFoldersLoading, refetch: refetchFolders } = useQuery({
    queryKey: ['folders', currentFolderId],
    queryFn: () => api.get<{ data: Folder[] }>(`/v1/folders${currentFolderId ? `?parentId=${currentFolderId}` : ''}`),
    enabled: statusData?.data.connected === true,
  })

  // 4. Query files in current directory
  const { data: filesData, isLoading: isFilesLoading, refetch: refetchFiles } = useQuery({
    queryKey: ['files', currentFolderId],
    queryFn: () => api.get<{ data: TeleFile[]; meta: { total: number } }>(`/v1/files${currentFolderId ? `?folderId=${currentFolderId}` : ''}`),
    enabled: statusData?.data.connected === true,
  })

  const handleRefresh = () => {
    refetchFolders()
    refetchFiles()
  }

  if (isStatusLoading || (statusData && !statusData.data.connected)) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-gray-400 animate-pulse">Checking Telegram session state...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        <StorageBar />
        <UploadZone onUploadComplete={handleRefresh} currentFolderId={currentFolderId} />
      </div>
      {statusData?.data.connected && <AssociationMap />}
      <FileGrid
        files={filesData?.data ?? []}
        folders={foldersData?.data ?? []}
        loading={isFilesLoading || isFoldersLoading}
        onRefresh={handleRefresh}
        currentFolderId={currentFolderId}
        setCurrentFolderId={setCurrentFolderId}
        breadcrumbs={breadcrumbs}
        setBreadcrumbs={setBreadcrumbs}
      />
    </div>
  )
}
