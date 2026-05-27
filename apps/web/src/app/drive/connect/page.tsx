'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Smartphone, MessageSquare, CheckCircle, Loader2, ArrowRight } from 'lucide-react'
import { api } from '@/lib/api'

type Step = 'phone' | 'code' | 'done'

export default function ConnectTelegramPage() {
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [needs2FA, setNeeds2FA] = useState(false)
  const [sessionData, setSessionData] = useState<{ sessionId: string; phoneCodeHash: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await api.post<{ data: { sessionId: string; phoneCodeHash: string } }>('/v1/telegram/auth/step1', { phone })
      setSessionData(res.data)
      setStep('code')
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Failed to send code')
    } finally {
      setLoading(false)
    }
  }

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!sessionData) return
    setLoading(true)
    setError('')
    try {
      await api.post('/v1/telegram/auth/step2', {
        sessionId: sessionData.sessionId,
        phone,
        phoneCodeHash: sessionData.phoneCodeHash,
        code,
        ...(needs2FA ? { password } : {}),
      })
      setStep('done')
    } catch (err: unknown) {
      const e_ = err as { code?: string; message?: string }
      if (e_.code === 'TFA_REQUIRED') {
        setNeeds2FA(true)
        setError('Two-factor authentication required. Enter your cloud password below.')
      } else {
        setError(e_.message ?? 'Invalid code')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm animate-fade-in">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {(['phone', 'code', 'done'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step === s || (['code', 'done'].includes(step) && i === 0) || (step === 'done' && i === 1) ? 'bg-brand-600 text-white' : 'bg-white/10 text-gray-500'}`}>
                {i + 1}
              </div>
              {i < 2 && <div className={`flex-1 h-0.5 ${i === 0 && step !== 'phone' ? 'bg-brand-600' : 'bg-white/10'}`} />}
            </div>
          ))}
        </div>

        {step === 'phone' && (
          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-brand-600/20 flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-brand-400" />
              </div>
              <div>
                <h2 className="font-semibold text-white">Connect Telegram</h2>
                <p className="text-xs text-gray-400">Enter your Telegram phone number</p>
              </div>
            </div>

            <form onSubmit={handlePhoneSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Phone Number</label>
                <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input" placeholder="+1 234 567 8900" required />
                <p className="text-xs text-gray-500 mt-1">Include country code (e.g. +1 for US)</p>
              </div>
              {error && <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</div>}
              <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Send Code <ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          </div>
        )}

        {step === 'code' && (
          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-brand-600/20 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-brand-400" />
              </div>
              <div>
                <h2 className="font-semibold text-white">Enter the code</h2>
                <p className="text-xs text-gray-400">Check your Telegram app for the code</p>
              </div>
            </div>

            <form onSubmit={handleCodeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Verification Code</label>
                <input id="otp" type="text" inputMode="numeric" pattern="\d*" value={code} onChange={(e) => setCode(e.target.value)} className="input text-center text-2xl tracking-widest" placeholder="12345" maxLength={5} required />
              </div>
              {needs2FA && (
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Cloud Password (2FA)</label>
                  <input id="tfa" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" placeholder="Your Telegram cloud password" required />
                </div>
              )}
              {error && <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</div>}
              <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify & Connect'}
              </button>
            </form>
          </div>
        )}

        {step === 'done' && (
          <div className="card text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="font-bold text-white text-xl mb-2">Telegram Connected!</h2>
            <p className="text-gray-400 text-sm mb-6">Your Telegram account is now linked. Start uploading files.</p>
            <button onClick={() => router.push('/drive')} className="btn-primary justify-center w-full">
              Go to My Drive <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
