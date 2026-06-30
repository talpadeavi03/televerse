import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/Providers'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'TeleVerse — Unlimited AI-Powered Cloud Storage',
  description: 'Store unlimited files for free. TeleVerse is a smart all-in-one cloud storage manager with automatic AI document scanning, summarization, and search.',
  keywords: ['cloud storage', 'unlimited storage', 'file manager', 'ai', 'televerse'],
  openGraph: {
    title: 'TeleVerse',
    description: 'Smart, unlimited, and free AI-powered cloud storage.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body className={`${inter.variable} font-sans bg-surface text-gray-100 antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
