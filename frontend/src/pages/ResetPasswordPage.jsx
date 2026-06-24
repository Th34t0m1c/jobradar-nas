import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { authApi } from '../api/client'
import { Spinner, isPasswordStrong } from '../components/ui'
import { Eye, EyeOff, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useIsMobile } from '../utils/useIsMobile'

const t = {
  violet:      '#7C3AED',
  violetDark:  '#5B21B6',
  violetMid:   '#8B5CF6',
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
        <circle key={`${r}-${c}`} cx={x} cy={y} r={size * 0.055}
          fill={highlight ? '#FFFFFF' : 'rgba(255,255,255,0.30)'}
          filter={highlight ? 'url(#glow)' : undefined}
        />
      )
    }
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
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

const inputStyle = {
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
}

const labelStyle = {
  display: 'block',
  fontFamily: t.fontDisplay,
  fontWeight: 600,
  fontSize: 13,
  color: t.inkMid,
  marginBottom: 5,
}

const PASSWORD_RULES = [
  { label: 'At least 8 characters',        test: v => v.length >= 8 },
  { label: 'One uppercase letter (A–Z)',    test: v => /[A-Z]/.test(v) },
  { label: 'One lowercase letter (a–z)',    test: v => /[a-z]/.test(v) },
  { label: 'One number (0–9)',              test: v => /\d/.test(v) },
  { label: 'One special character (!@#$…)', test: v => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(v) },
]

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  const [form, setForm] = useState({ new_password: '', confirm_password: '' })
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const isMobile = useIsMobile()

  async function handleSubmit(e) {
    e.preventDefault()
    if (!isPasswordStrong(form.new_password)) {
      toast.error('Please meet all password requirements before continuing')
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

  // ── Invalid token guard ───────────────────────────────────────────────────
  if (!token) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', fontFamily: t.fontBody, background: t.bg }}>
        <div style={{ width: 360, flexShrink: 0, background: t.panelGrad, display: isMobile ? 'none' : 'flex', flexDirection: 'column', padding: '44px 40px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative', zIndex: 1 }}>
            <LogoMark size={32} />
            <span style={{ fontFamily: t.fontDisplay, fontWeight: 700, fontSize: 18, letterSpacing: '-0.025em' }}>
              <span style={{ color: '#FFFFFF' }}>Job</span><span style={{ color: '#A78BFA' }}>Radar</span>
            </span>
          </div>
        </div>
        <div style={{ flex: 1, background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '40px 24px' : '48px 40px', minHeight: '100vh' }}>
          <div style={{ width: '100%', maxWidth: 380, textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#FEF2F2', border: '1.5px solid #FCA5A5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <AlertTriangle size={24} color="#DC2626" />
            </div>
            <h1 style={{ fontFamily: t.fontDisplay, fontWeight: 800, fontSize: 24, color: t.ink, marginBottom: 8 }}>Invalid link</h1>
            <p style={{ fontSize: 14, color: t.inkMid, lineHeight: 1.6, marginBottom: 24, fontFamily: t.fontBody }}>
              This reset link is missing a token. Please request a new one.
            </p>
            <Link to="/forgot-password" style={{ display: 'inline-block', background: t.violet, color: '#FFFFFF', borderRadius: 9, padding: '11px 24px', fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
              Request new link
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: t.fontBody, background: t.bg }}>

      {/* ── Left violet panel ─────────────────────────────────────── */}
      <div style={{
        width: 360, flexShrink: 0, background: t.panelGrad,
        display: isMobile ? 'none' : 'flex', flexDirection: 'column',
        padding: '44px 40px', position: 'relative', overflow: 'hidden',
      }}>
        <svg aria-hidden="true" style={{ position: 'absolute', top: -60, right: -60, opacity: 0.10, pointerEvents: 'none' }}
          width="320" height="320" viewBox="0 0 320 320" fill="none">
          {[130, 95, 60, 25].map(r => (
            <circle key={r} cx="160" cy="160" r={r} stroke="white" strokeWidth="1.5" fill="none" />
          ))}
        </svg>
        <svg aria-hidden="true" style={{ position: 'absolute', bottom: -40, left: -40, opacity: 0.08, pointerEvents: 'none' }}
          width="260" height="260" viewBox="0 0 260 260" fill="none">
          {[110, 75, 40].map(r => (
            <circle key={r} cx="130" cy="130" r={r} stroke="white" strokeWidth="1.5" fill="none" />
          ))}
        </svg>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative', zIndex: 1 }}>
          <LogoMark size={32} />
          <span style={{ fontFamily: t.fontDisplay, fontWeight: 700, fontSize: 18, letterSpacing: '-0.025em' }}>
            <span style={{ color: '#FFFFFF' }}>Job</span>
            <span style={{ color: '#A78BFA' }}>Radar</span>
          </span>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontFamily: t.fontDisplay, fontWeight: 800, fontSize: 30, color: '#FFFFFF', lineHeight: 1.2, marginBottom: 14 }}>
            Almost there.
          </h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.80)', lineHeight: 1.6, marginBottom: 32, fontFamily: t.fontBody }}>
            Choose a strong new password and get back to your job search. Your matches and filters are right where you left them.
          </p>
          {[
            'Password is hashed and never stored in plain text',
            'Reset link is single-use and time-limited',
            'All your data stays intact',
          ].map(text => (
            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(255,255,255,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ color: '#FFFFFF', fontSize: 11, lineHeight: 1 }}>✓</span>
              </div>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.88)', fontWeight: 500 }}>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right form panel ──────────────────────────────────────── */}
      <div style={{ flex: 1, background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '40px 24px' : '48px 40px', minHeight: '100vh' }}>
        <div style={{ width: '100%', maxWidth: 380 }}>

          <h1 style={{ fontFamily: t.fontDisplay, fontWeight: 800, fontSize: 26, color: t.ink, marginBottom: 6 }}>
            Set new password
          </h1>
          <p style={{ fontSize: 14, color: t.inkMid, marginBottom: 28, fontFamily: t.fontBody }}>
            Choose a strong password to secure your{' '}
            <span style={{ color: t.violet }}>account.</span>
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* New password */}
            <div>
              <label style={labelStyle}>New password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={form.new_password}
                  onChange={(e) => setForm({ ...form, new_password: e.target.value })}
                  required
                  style={{ ...inputStyle, paddingRight: 42 }}
                  onFocus={e => { e.target.style.borderColor = t.violet }}
                  onBlur={e => { e.target.style.borderColor = t.border }}
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: t.inkLight, display: 'flex', alignItems: 'center', padding: 0 }}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div>
              <label style={labelStyle}>Confirm password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={form.confirm_password}
                  onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
                  required
                  style={{ ...inputStyle, paddingRight: 42 }}
                  onFocus={e => { e.target.style.borderColor = t.violet }}
                  onBlur={e => { e.target.style.borderColor = t.border }}
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: t.inkLight, display: 'flex', alignItems: 'center', padding: 0 }}>
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Live password checklist */}
            {form.new_password && (
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 3, margin: '-6px 0 0' }}>
                {PASSWORD_RULES.map(({ label, test }) => {
                  const met = test(form.new_password)
                  return (
                    <li key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontFamily: t.fontBody, color: met ? '#059669' : t.inkLight, listStyle: 'none' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{met ? '✓' : '✗'}</span>
                      {label}
                    </li>
                  )
                })}
              </ul>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', background: t.violet, color: '#FFFFFF',
                border: 'none', borderRadius: 9, padding: '12px 20px',
                fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 14,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: loading ? 0.7 : 1, transition: 'opacity 0.15s',
              }}
            >
              {loading && <Spinner size="sm" className="text-white" />}
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: 13, color: t.inkMid, marginTop: 24, fontFamily: t.fontBody }}>
            Remembered it?{' '}
            <Link to="/login" style={{ color: t.violet, fontWeight: 600, textDecoration: 'none', fontFamily: t.fontDisplay }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
