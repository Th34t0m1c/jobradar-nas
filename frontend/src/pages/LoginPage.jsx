import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { Spinner } from '../components/ui'
import { Radio, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const { login } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await login(form.email, form.password)
      // login() triggers window.location.href = '/dashboard' internally
    } catch {
      toast.error('Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-950 bg-grid-pattern bg-grid px-4">
      <div className="w-full max-w-sm animate-fade-up">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10 justify-center">
          <div className="w-10 h-10 rounded-xl bg-signal-muted border border-signal/30 flex items-center justify-center shadow-signal">
            <Radio className="w-5 h-5 text-signal" />
          </div>
          <div>
            <p className="font-display font-bold text-white text-xl tracking-tight">JobRadar</p>
            <p className="text-xs text-slate-600 font-body">AI Job Aggregator</p>
          </div>
        </div>

        {/* Card */}
        <div className="card p-8">
          <h2 className="font-display font-bold text-white text-lg mb-1">Welcome back</h2>
          <p className="text-sm text-slate-500 mb-6 font-body">Sign in to your dashboard</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0">Password</label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-slate-500 hover:text-signal transition-colors font-body"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
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
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2 flex items-center justify-center gap-2">
              {loading ? <Spinner size="sm" /> : null}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500 mt-6 font-body">
          Don't have an account?{' '}
          <Link to="/register" className="text-signal hover:text-signal-dim transition-colors font-medium">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
