import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { Spinner } from '../components/ui'
import { Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { useIsMobile } from '../utils/useIsMobile'

// ── Design tokens (scoped to auth pages) ──────────────────────────────────────
const t = {
  violet:      '#7C3AED',
  violetDark:  '#5B21B6',
  violetMid:   '#8B5CF6',
  violetLight: '#EDE9FE',
  bg:          '#F5F4F0',
  surface:     '#FFFFFF',
  border:      '#E4E2DC',
  ink:         '#18181B',
  inkMid:      '#52525B',
  inkLight:    '#A1A1AA',
  panelGrad:   'linear-gradient(145deg, #5B21B6 0%, #7C3AED 55%, #8B5CF6 100%)',
  fontDisplay: '"Plus Jakarta Sans", system-ui, sans-serif',
  fontBody:    '"Inter", system-ui, sans-serif',
}

// ── Inline logo (4×4 dot grid on violet square) ───────────────────────────────
function LogoMark({ size = 32 }) {
  const rx = Math.round(size * 0.26)
  const dots = []
  const pad = size * 0.18
  const gap = (size - pad * 2) / 3
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const x = pad + c * gap
      const y = pad + r * gap
      const highlight = r === 0 && c === 3
      dots.push(
        <circle
          key={`${r}-${c}`}
          cx={x} cy={y} r={size * 0.055}
          fill={highlight ? '#FFFFFF' : 'rgba(255,255,255,0.30)'}
          filter={highlight ? 'url(#glow)' : undefined}
        />
      )
    }
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation={size * 0.07} result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <rect width={size} height={size} rx={rx} fill={t.violet} />
      {dots}
    </svg>
  )
}

function LogoWordmark({ theme = 'light' }) {
  const jobColor  = theme === 'light' ? '#FFFFFF' : t.ink
  const radarColor = theme === 'light' ? '#A78BFA' : t.violet
  return (
    <span style={{ fontFamily: t.fontDisplay, fontWeight: 700, fontSize: 18, letterSpacing: '-0.025em' }}>
      <span style={{ color: jobColor }}>Job</span>
      <span style={{ color: radarColor }}>Radar</span>
    </span>
  )
}

export default function LoginPage() {
  const { login } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const isMobile = useIsMobile()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await login(form.email, form.password)
      // login() triggers window.location.href = '/dashboard' internally
    } catch (err) {
      const detail = err?.response?.data?.detail
      if (Array.isArray(detail)) {
        // Pydantic 422 — e.g. invalid email format
        const raw = detail[0]?.ctx?.error ?? detail[0]?.msg ?? 'Invalid email or password'
        toast.error(String(raw).replace(/^Value error,\s*/i, ''))
      } else {
        toast.error('Invalid email or password')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: t.fontBody, background: t.bg }}>

      {/* ── Left violet panel ─────────────────────────────────────── */}
      <div style={{
        width: 360,
        flexShrink: 0,
        background: t.panelGrad,
        display: isMobile ? 'none' : 'flex',
        flexDirection: 'column',
        padding: '44px 40px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative circles — top right */}
        <svg aria-hidden="true" style={{ position: 'absolute', top: -60, right: -60, opacity: 0.10, pointerEvents: 'none' }}
          width="320" height="320" viewBox="0 0 320 320" fill="none">
          {[130, 95, 60, 25].map(r => (
            <circle key={r} cx="160" cy="160" r={r} stroke="white" strokeWidth="1.5" fill="none" />
          ))}
        </svg>
        {/* Decorative circles — bottom left */}
        <svg aria-hidden="true" style={{ position: 'absolute', bottom: -40, left: -40, opacity: 0.08, pointerEvents: 'none' }}
          width="260" height="260" viewBox="0 0 260 260" fill="none">
          {[110, 75, 40].map(r => (
            <circle key={r} cx="130" cy="130" r={r} stroke="white" strokeWidth="1.5" fill="none" />
          ))}
        </svg>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative', zIndex: 1 }}>
          <LogoMark size={32} />
          <LogoWordmark theme="light" />
        </div>

        {/* Main content — vertically centered */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
          <h2 style={{
            fontFamily: t.fontDisplay,
            fontWeight: 800,
            fontSize: 30,
            color: '#FFFFFF',
            lineHeight: 1.2,
            marginBottom: 14,
          }}>
            Welcome back.
          </h2>
          <p style={{
            fontSize: 13,
            color: 'rgba(255,255,255,0.80)',
            lineHeight: 1.6,
            marginBottom: 32,
            fontFamily: t.fontBody,
          }}>
            Your job pipeline is waiting. Log in to see new matches, update your applications, and stay ahead of the market.
          </p>

          {/* Feature bullets */}
          {[
            'New jobs fetched daily from 8+ platforms',
            'Ranked by match score against your CV',
            'Track every application in one place',
          ].map(text => (
            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 18, height: 18,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.20)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span style={{ color: '#FFFFFF', fontSize: 11, lineHeight: 1 }}>✓</span>
              </div>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.88)', fontWeight: 500 }}>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right form panel ──────────────────────────────────────── */}
      <div style={{
        flex: 1,
        background: t.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile ? '40px 24px' : '48px 40px',
        minHeight: '100vh',
      }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          {/* Heading */}
          <h1 style={{
            fontFamily: t.fontDisplay,
            fontWeight: 800,
            fontSize: 26,
            color: t.ink,
            marginBottom: 6,
          }}>Sign in</h1>
          <p style={{ fontSize: 14, color: t.inkMid, marginBottom: 28, fontFamily: t.fontBody }}>
            Welcome back — pick up where you left off.
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Email */}
            <div>
              <label style={{
                display: 'block',
                fontFamily: t.fontDisplay,
                fontWeight: 600,
                fontSize: 13,
                color: t.inkMid,
                marginBottom: 5,
              }}>Email</label>
              <input
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                style={{
                  width: '100%',
                  border: `1.5px solid ${t.border}`,
                  borderRadius: 9,
                  padding: '11px 14px',
                  fontFamily: t.fontBody,
                  fontSize: 14,
                  color: t.ink,
                  background: t.surface,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                onFocus={e => { e.target.style.borderColor = t.violet }}
                onBlur={e => { e.target.style.borderColor = t.border }}
              />
            </div>

            {/* Password */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <label style={{
                  fontFamily: t.fontDisplay,
                  fontWeight: 600,
                  fontSize: 13,
                  color: t.inkMid,
                }}>Password</label>
                <Link to="/forgot-password" style={{
                  fontFamily: t.fontDisplay,
                  fontWeight: 600,
                  fontSize: 13,
                  color: t.violet,
                  textDecoration: 'none',
                }}>
                  Forgot password?
                </Link>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    border: `1.5px solid ${t.border}`,
                    borderRadius: 9,
                    padding: '11px 42px 11px 14px',
                    fontFamily: t.fontBody,
                    fontSize: 14,
                    color: t.ink,
                    background: t.surface,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => { e.target.style.borderColor = t.violet }}
                  onBlur={e => { e.target.style.borderColor = t.border }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: t.inkLight,
                    display: 'flex',
                    alignItems: 'center',
                    padding: 0,
                  }}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: loading ? t.violetMid : t.violet,
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 9,
                padding: '12px 20px',
                fontFamily: t.fontDisplay,
                fontWeight: 600,
                fontSize: 14,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                marginTop: 4,
                opacity: loading ? 0.7 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {loading && <Spinner size="sm" className="text-white" />}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {/* Footer */}
          <p style={{
            textAlign: 'center',
            fontSize: 13,
            color: t.inkMid,
            marginTop: 24,
            fontFamily: t.fontBody,
          }}>
            No account?{' '}
            <Link to="/register" style={{
              color: t.violet,
              fontWeight: 600,
              textDecoration: 'none',
              fontFamily: t.fontDisplay,
            }}>
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
