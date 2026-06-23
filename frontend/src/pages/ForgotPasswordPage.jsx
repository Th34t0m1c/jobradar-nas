import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '../api/client'
import { Spinner } from '../components/ui'
import { Radio, CheckCircle } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await authApi.forgotPassword(email)
    } catch {
      // Intentionally swallowed — always show the success state to prevent
      // email enumeration (server also always returns 200)
    } finally {
      setSent(true)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-950 bg-grid-pattern bg-grid px-4">
      <div className="w-full max-w-sm animate-fade-up">

        <div className="flex items-center gap-3 mb-10 justify-center">
          <div className="w-10 h-10 rounded-xl bg-signal-muted border border-signal/30 flex items-center justify-center shadow-signal">
            <Radio className="w-5 h-5 text-signal" />
          </div>
          <div>
            <p className="font-display font-bold text-white text-xl tracking-tight">JobRadar</p>
            <p className="text-xs text-slate-600 font-body">AI Job Aggregator</p>
          </div>
        </div>

        <div className="card p-8">
          {sent ? (
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-signal-muted border border-signal/30 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-6 h-6 text-signal" />
              </div>
              <h2 className="font-display font-bold text-white text-lg mb-2">Check your inbox</h2>
              <p className="text-sm text-slate-400 font-body leading-relaxed">
                If an account exists for{' '}
                <span className="text-slate-200">{email}</span>,
                {' '}you'll receive a password reset link shortly.
              </p>
              <p className="text-xs text-slate-600 mt-3 font-body">
                The link expires in 1 hour.
              </p>
            </div>
          ) : (
            <>
              <h2 className="font-display font-bold text-white text-lg mb-1">Forgot password?</h2>
              <p className="text-sm text-slate-500 mb-6 font-body">
                Enter your email and we'll send a reset link.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Email</label>
                  <input
                    className="input"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full mt-2 flex items-center justify-center gap-2"
                >
                  {loading ? <Spinner size="sm" /> : null}
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-sm text-slate-500 mt-6 font-body">
          <Link to="/login" className="text-signal hover:text-signal-dim transition-colors font-medium">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
