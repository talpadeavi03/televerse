import { Sidebar } from '@/components/drive/Sidebar'
import { DriveHeader } from '@/components/drive/DriveHeader'

export default function DriveLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-surface overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <DriveHeader />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  )
}
