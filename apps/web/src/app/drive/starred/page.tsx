'use client'

import { Star, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function StarredPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 text-center animate-fade-in px-4">
      {/* Icon Ring */}
      <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center border border-brand-500/20 text-brand-400">
        <Star className="w-8 h-8 fill-brand-400/25" />
      </div>
      
      {/* Description */}
      <div className="max-w-md space-y-2">
        <h1 className="text-xl font-bold text-white">Starred Documents</h1>
        <p className="text-sm text-gray-400 leading-relaxed">
          Quickly access your most important files. Starred items will be fully supported as virtual metadata tags in the upcoming **Phase 2** Virtual Filesystem release!
        </p>
      </div>

      {/* Buttons */}
      <Link href="/drive" className="btn-secondary text-xs">
        <ArrowLeft className="w-4 h-4" /> Back to My Drive
      </Link>
    </div>
  )
}
