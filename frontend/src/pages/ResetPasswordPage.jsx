import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { authApi } from '../api/client'
import { Spinner, PasswordRules, isPasswordStrong } from '../components/ui'
import { Radio, Eye, EyeOff, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  const [form, setForm] = useState({ new_password: '', confirm_password: '' })
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!isPasswordStrong(form.new_password)) {
      toast.error('Password does not meet the requirements')
      return
    }
    if (form.new_password !== form.confirm_password) {
      toast.error('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      await authApi.resetPassword(token, form.new_password, form.confirm_password)
      toast.success('Password reset — please sign in')
      navigate('/login')
    } catch (err) {
      const detail = err.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Reset failed — link may be expired')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-950 bg-grid-pattern bg-grid px-4">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="card p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <h2 className="font-display font-bold text-white text-lg mb-2">Invalid link</h2>
            <p className="text-sm text-slate-400 font-body mb-6">
              This reset link is missing a token. Please request a new one.
            </p>
            <Link to="/forgot-password" className="btn-primary inline-block">
              Request new link
            </Link>
          </div>
        </div>
      </div>
    )
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
          <h2 className="font-display font-bold text-white text-lg mb-1">Set new password</h2>
          <p className="text-sm text-slate-500 mb-6 font-body">Choose a strong password (min. 8 characters).</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">New Password</label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Strong password"
                  value={form.new_password}
                  onChange={(e) => setForm({ ...form, new_password: e.target.value })}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <PasswordRules password={form.new_password} />
            </div>

            <div>
              <label className="label">Confirm Password</label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={form.confirm_password}
                  onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-2 flex items-center justify-center gap-2"
            >
              {loading ? <Spinner size="sm" /> : null}
              {loading ? 'Resetting…' : 'Reset password'}
            </button>
          </form>
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
