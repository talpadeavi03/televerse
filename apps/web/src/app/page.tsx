import Link from 'next/link'
import { Cloud, Zap, Shield, Cpu, ArrowRight, Github } from 'lucide-react'

const FEATURES = [
  { icon: Cloud, title: 'Unlimited Storage', desc: 'Files stored in your own Telegram account. No size limits on account storage.' },
  { icon: Zap, title: 'Lightning Fast', desc: 'MTProto protocol for blazing fast uploads and downloads. 4x concurrent chunks.' },
  { icon: Shield, title: 'Secure by Design', desc: 'AES-256-GCM session encryption. Your session, your data, your control.' },
  { icon: Cpu, title: 'AI-Powered', desc: 'Auto-tagging, smart summaries, semantic search, and AI chat with your files.' },
]

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-surface relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-brand-600/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-800/10 rounded-full blur-3xl" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center">
            <Cloud className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl text-gradient">TeleVerse</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/auth/login" className="btn-ghost">Sign In</Link>
          <Link href="/auth/register" className="btn-primary">Get Started <ArrowRight className="w-4 h-4" /></Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 text-center px-6 pt-20 pb-16 max-w-4xl mx-auto animate-fade-in">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs text-brand-300 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          Open Source · Zero Cost · Unlimited Storage
        </div>
        <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
          Your files,
          <br />
          <span className="text-gradient">powered by Telegram</span>
        </h1>
        <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
          TeleVerse is an intelligent file manager that stores everything in your own Telegram account.
          Unlimited free storage, AI summaries, and a stunning UI.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link href="/auth/register" className="btn-primary text-base px-6 py-3">
            Start Free <ArrowRight className="w-5 h-5" />
          </Link>
          <a href="https://github.com/your-org/televerse" target="_blank" rel="noreferrer" className="btn-ghost text-base px-6 py-3">
            <Github className="w-5 h-5" /> View on GitHub
          </a>
        </div>
      </section>

      {/* Storage comparison */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 pb-16">
        <div className="glass rounded-2xl overflow-hidden animate-slide-up">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-6 py-4 text-gray-400 font-medium">Feature</th>
                <th className="px-6 py-4 text-gray-400 font-medium">Google Drive</th>
                <th className="px-6 py-4 text-gray-400 font-medium">OneDrive</th>
                <th className="px-6 py-4 text-brand-300 font-semibold">TeleVerse ✨</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Storage', '15 GB free', '5 GB free', '∞ Free'],
                ['Cost', '$2.99+/mo', '$1.99+/mo', 'Zero forever'],
                ['AI Features', 'Limited', 'Limited', 'Full AI suite'],
                ['Open Source', '✗', '✗', '✓'],
                ['Data Ownership', 'Google', 'Microsoft', 'You'],
              ].map(([feature, g, o, t]) => (
                <tr key={feature} className="border-b border-white/5 last:border-0">
                  <td className="px-6 py-3 text-gray-300 font-medium">{feature}</td>
                  <td className="px-6 py-3 text-center text-gray-500">{g}</td>
                  <td className="px-6 py-3 text-center text-gray-500">{o}</td>
                  <td className="px-6 py-3 text-center text-brand-400 font-semibold">{t}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Features grid */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
        <h2 className="text-3xl font-bold text-center mb-12">Everything you need</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card hover:border-brand-500/30 hover:bg-brand-600/5 transition-all duration-300 group">
              <div className="w-10 h-10 rounded-lg bg-brand-600/20 flex items-center justify-center mb-3 group-hover:bg-brand-600/40 transition-colors">
                <Icon className="w-5 h-5 text-brand-400" />
              </div>
              <h3 className="font-semibold text-white mb-2">{title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 px-6 py-6 text-center text-sm text-gray-500">
        <p>TeleVerse uses the Telegram MTProto Client API — legally permitted by Telegram&apos;s Terms of Service.</p>
        <p className="mt-1">Built with ❤️ | MIT License</p>
      </footer>
    </main>
  )
}
