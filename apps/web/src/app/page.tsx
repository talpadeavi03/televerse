import Link from 'next/link'
import { Cloud, Zap, Shield, Cpu, ArrowRight, Github, Sparkles, Search, MessageSquare, FileText } from 'lucide-react'

const FEATURES = [
  { icon: Cloud, title: 'Unlimited Storage', desc: 'Store files of any size or type with absolutely zero limits on total account size.' },
  { icon: Zap, title: 'Blazing Fast Speed', desc: 'Advanced parallel chunk uploading and instant download pipelines.' },
  { icon: Shield, title: 'Absolute Security', desc: 'End-to-end user-side session encryption keys. You own and control your data.' },
  { icon: Cpu, title: 'AI Intelligence', desc: 'Auto-tagging, smart summaries, semantic search, and document AI chat assistants.' },
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
      <section className="relative z-10 text-center px-6 pt-20 pb-8 max-w-4xl mx-auto animate-fade-in">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs text-brand-300 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          100% Free · Unlimited Cloud Storage · AI-Powered
        </div>
        <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
          Your Intelligent
          <br />
          <span className="text-gradient">All-in-One Cloud Storage</span>
        </h1>
        <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
          TeleVerse is a smart, zero-cost alternative to Google Drive.
          Get unlimited cloud storage, automatic document scanning, AI summaries, and instant search.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap mb-12">
          <Link href="/auth/register" className="btn-primary text-base px-6 py-3">
            Start Storing Now <ArrowRight className="w-5 h-5" />
          </Link>
          <a href="https://github.com/talpadeavi03/televerse" target="_blank" rel="noreferrer" className="btn-ghost text-base px-6 py-3">
            <Github className="w-5 h-5" /> View on GitHub
          </a>
        </div>
      </section>

      {/* Premium Dashboard Mockup */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pb-24">
        <div className="glass rounded-2xl p-4 md:p-6 shadow-2xl border border-white/10 animate-slide-up relative">
          {/* Mockup Header */}
          <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div className="w-3 h-3 rounded-full bg-green-500/80" />
              <span className="text-xs text-gray-500 ml-4 font-mono">televerse-dashboard.json</span>
            </div>
            <div className="flex items-center gap-2 max-w-xs w-full bg-white/5 border border-white/5 rounded-lg px-2.5 py-1 text-xs text-gray-400">
              <Search className="w-3.5 h-3.5 text-gray-500" />
              <span>Search files by AI tags, contents...</span>
            </div>
          </div>

          {/* Mockup Layout */}
          <div className="grid md:grid-cols-3 gap-6">
            {/* Mockup Files (Left 2 cols) */}
            <div className="md:col-span-2 space-y-3">
              <div className="flex items-center justify-between text-xs text-gray-500 font-semibold uppercase tracking-wider px-1">
                <span>Recent Files</span>
                <span>Size / Uploaded</span>
              </div>
              
              {/* File Row 1 */}
              <div className="bg-white/[0.02] border border-white/5 hover:border-white/10 rounded-xl p-3.5 flex items-center justify-between transition-all">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white flex items-center gap-1.5">
                      Q4_Report.pdf
                      <span className="px-1.5 py-0.5 rounded-full bg-brand-500/10 text-brand-300 text-[10px] font-semibold border border-brand-500/20">AI Scanned</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1 max-w-[280px] md:max-w-md truncate">
                      <span className="text-purple-400 font-medium">Summary:</span> Key highlights include a 45% revenue increase and 20% margin gain.
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      <span className="text-[10px] bg-white/5 border border-white/5 text-gray-300 rounded px-1.5 py-0.5">#financials</span>
                      <span className="text-[10px] bg-white/5 border border-white/5 text-gray-300 rounded px-1.5 py-0.5">#q4-goals</span>
                    </div>
                  </div>
                </div>
                <div className="text-right text-xs shrink-0 pl-4">
                  <div className="text-gray-300 font-medium">12.4 MB</div>
                  <div className="text-gray-500 mt-1">2 mins ago</div>
                </div>
              </div>

              {/* File Row 2 */}
              <div className="bg-white/[0.02] border border-white/5 hover:border-white/10 rounded-xl p-3.5 flex items-center justify-between transition-all">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white flex items-center gap-1.5">
                      Project_Proposal.docx
                      <span className="px-1.5 py-0.5 rounded-full bg-brand-500/10 text-brand-300 text-[10px] font-semibold border border-brand-500/20">AI Scanned</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1 max-w-[280px] md:max-w-md truncate">
                      <span className="text-purple-400 font-medium">Summary:</span> Timeline and deliverables for the new landing page build.
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      <span className="text-[10px] bg-white/5 border border-white/5 text-gray-300 rounded px-1.5 py-0.5">#roadmap</span>
                      <span className="text-[10px] bg-white/5 border border-white/5 text-gray-300 rounded px-1.5 py-0.5">#design</span>
                    </div>
                  </div>
                </div>
                <div className="text-right text-xs shrink-0 pl-4">
                  <div className="text-gray-300 font-medium">1.8 MB</div>
                  <div className="text-gray-500 mt-1">1 hour ago</div>
                </div>
              </div>
            </div>

            {/* Mockup AI Side Panel (Right 1 col) */}
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-brand-300 text-xs font-semibold uppercase tracking-wider mb-3">
                  <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                  <span>AI Assistant</span>
                </div>
                <div className="space-y-3 text-xs">
                  <div className="bg-white/5 border border-white/5 rounded-lg p-2.5 text-gray-300 leading-relaxed">
                    &ldquo;I analyzed your uploaded PDFs. Would you like me to find the Q4 action items or compile a summary?&rdquo;
                  </div>
                  <div className="bg-brand-500/10 border border-brand-500/10 rounded-lg p-2.5 text-brand-300 text-right ml-4">
                    &ldquo;Yes, show me the Q4 goals.&rdquo;
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-gray-400">
                <span>Ask AI anything about files...</span>
                <MessageSquare className="w-4 h-4 text-brand-400" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
        <h2 className="text-3xl font-bold text-center mb-12">Everything you need from a modern cloud</h2>
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

      {/* Document Scanning & intelligence Section */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pb-24">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand-400 mb-4">
              <Sparkles className="w-4 h-4" />
              <span>AI Document Scanner & intelligence</span>
            </div>
            <h3 className="text-3xl font-bold text-white mb-6">
              Don&apos;t just store documents.
              <br />
              <span className="text-gradient">Scan, digest, and query them.</span>
            </h3>
            <p className="text-gray-400 leading-relaxed mb-6">
              When you upload files, TeleVerse automatically scans and processes documents, extracting core insights, summarizing findings, and attaching semantic tags so they can be retrieved instantly.
            </p>
            <ul className="space-y-3.5 text-sm text-gray-300">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                Auto-summarize PDFs, Word documents, and text files.
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                Automatic semantic tags generated with Groq/OpenAI.
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                Chat directly with individual files or across folders.
              </li>
            </ul>
          </div>
          <div className="card border-brand-500/20 bg-brand-600/5 p-6 flex flex-col justify-center">
            <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-brand-400" /> AI Document Scanner Engine
            </h4>
            <div className="space-y-4">
              <div className="bg-white/5 border border-white/5 rounded-lg p-3 text-xs">
                <div className="font-semibold text-gray-400 uppercase tracking-wider text-[10px] mb-1">OCR & Text Extraction</div>
                <div className="text-gray-200">&ldquo;Q4 margins expanded to 35% with total growth index reaching 1.2...&rdquo;</div>
              </div>
              <div className="bg-white/5 border border-white/5 rounded-lg p-3 text-xs">
                <div className="font-semibold text-gray-400 uppercase tracking-wider text-[10px] mb-1">Generated AI Metadata</div>
                <div className="text-gray-200"><span className="text-brand-300 font-medium">Summary:</span> Document details Q4 performance, margins growth, and index stats.</div>
              </div>
              <div className="bg-white/5 border border-white/5 rounded-lg p-3 text-xs">
                <div className="font-semibold text-gray-400 uppercase tracking-wider text-[10px] mb-1">Semantic Tags</div>
                <div className="flex gap-1.5 mt-1">
                  <span className="bg-brand-500/10 text-brand-300 border border-brand-500/20 rounded px-1.5 py-0.5">#margin</span>
                  <span className="bg-brand-500/10 text-brand-300 border border-brand-500/20 rounded px-1.5 py-0.5">#growth</span>
                  <span className="bg-brand-500/10 text-brand-300 border border-brand-500/20 rounded px-1.5 py-0.5">#report</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 px-6 py-6 text-center text-sm text-gray-500">
        <p>TeleVerse Cloud — Smart, Unlimited, and Secure File Storage.</p>
        <p className="mt-1">Built with ❤️ | MIT License</p>
      </footer>
    </main>
  )
}
