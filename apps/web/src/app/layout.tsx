import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/Providers'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'TeleVerse — Your Telegram Cloud Drive',
  description: 'Store unlimited files in your own Telegram account. The smart file manager for Telegram.',
  keywords: ['telegram', 'cloud storage', 'file manager', 'televerse'],
  openGraph: {
    title: 'TeleVerse',
    description: 'Store unlimited files in your Telegram account',
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
