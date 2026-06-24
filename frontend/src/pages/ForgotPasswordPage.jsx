import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '../api/client'
import { Spinner } from '../components/ui'
import { CheckCircle, ArrowLeft } from 'lucide-react'
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

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const isMobile = useIsMobile()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await authApi.forgotPassword(email)
    } catch {
      // Intentionally swallowed — always show success to prevent email enumeration
    } finally {
      setSent(true)
      setLoading(false)
    }
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
            Happens to<br />everyone.
          </h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.80)', lineHeight: 1.6, marginBottom: 32, fontFamily: t.fontBody }}>
            We'll send a reset link to your inbox. You'll be back to tracking your job search in under a minute.
          </p>
          {[
            'Reset link expires in 1 hour',
            'No account enumeration — always 200',
            'Back to your pipeline in seconds',
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

          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: '#ECFDF5', border: '1.5px solid #6EE7B7',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px',
              }}>
                <CheckCircle size={24} color="#059669" />
              </div>
              <h1 style={{ fontFamily: t.fontDisplay, fontWeight: 800, fontSize: 24, color: t.ink, marginBottom: 8 }}>
                Check your inbox
              </h1>
              <p style={{ fontSize: 14, color: t.inkMid, lineHeight: 1.6, marginBottom: 6, fontFamily: t.fontBody }}>
                If an account exists for{' '}
                <span style={{ color: t.ink, fontWeight: 600 }}>{email}</span>,
                {' '}you'll receive a reset link shortly.
              </p>
              <p style={{ fontSize: 12, color: t.inkLight, fontFamily: t.fontBody, marginBottom: 28 }}>
                The link expires in 1 hour.
              </p>
              <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: t.violet, fontWeight: 600, textDecoration: 'none', fontFamily: t.fontDisplay }}>
                <ArrowLeft size={14} /> Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, color: t.inkMid, textDecoration: 'none', fontFamily: t.fontBody, marginBottom: 24 }}>
                <ArrowLeft size={14} /> Back to sign in
              </Link>

              <h1 style={{ fontFamily: t.fontDisplay, fontWeight: 800, fontSize: 26, color: t.ink, marginBottom: 6 }}>
                Reset password
              </h1>
              <p style={{ fontSize: 14, color: t.inkMid, marginBottom: 28, fontFamily: t.fontBody }}>
                We'll send a reset link to your email address.
              </p>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <label style={labelStyle}>Email address</label>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={inputStyle}
                    onFocus={e => { e.target.style.borderColor = t.violet }}
                    onBlur={e => { e.target.style.borderColor = t.border }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%', background: t.violet, color: '#FFFFFF',
                    border: 'none', borderRadius: 9, padding: '12px 20px',
                    fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 14,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    marginTop: 4, opacity: loading ? 0.7 : 1, transition: 'opacity 0.15s',
                  }}
                >
                  {loading && <Spinner size="sm" className="text-white" />}
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
