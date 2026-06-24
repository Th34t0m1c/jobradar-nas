import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../api/client'
import { Spinner, isPasswordStrong } from '../components/ui'
import { Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { useIsMobile } from '../utils/useIsMobile'

const t = {
  violet:      '#7C3AED',
  violetHover: '#6D28D9',
  bg:          '#F5F4F0',
  surface:     '#FFFFFF',
  border:      '#E4E2DC',
  ink:         '#18181B',
  inkMid:      '#52525B',
  inkLight:    '#A1A1AA',
  fontDisplay: '"Plus Jakarta Sans", system-ui, sans-serif',
  fontBody:    '"Inter", system-ui, sans-serif',
}

const inputStyle = {
  width: '100%',
  border: `1.5px solid ${t.border}`,
  borderRadius: 8,
  padding: '10px 14px',
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

const cardStyle = {
  background: t.surface,
  border: `1px solid ${t.border}`,
  borderRadius: 12,
  padding: 24,
}

const PASSWORD_RULES = [
  { label: 'At least 8 characters',        test: v => v.length >= 8 },
  { label: 'One uppercase letter (A–Z)',    test: v => /[A-Z]/.test(v) },
  { label: 'One lowercase letter (a–z)',    test: v => /[a-z]/.test(v) },
  { label: 'One number (0–9)',              test: v => /\d/.test(v) },
  { label: 'One special character (!@#$…)', test: v => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(v) },
]

export default function ProfilePage() {
  const queryClient = useQueryClient()
  const isMobile = useIsMobile()

  const { data: user, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => authApi.me().then(r => r.data),
    staleTime: 300_000,
  })

  const [profileForm, setProfileForm] = useState({ full_name: '', email: '' })
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    if (user) setProfileForm({ full_name: user.full_name, email: user.email })
  }, [user])

  const profileMutation = useMutation({
    mutationFn: (data) => authApi.updateProfile(data),
    onSuccess: (res) => {
      queryClient.setQueryData(['me'], res.data)
      toast.success('Profile updated')
    },
    onError: (err) => {
      const detail = err.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Update failed')
    },
  })

  const passwordMutation = useMutation({
    mutationFn: (data) => authApi.changePassword(data),
    onSuccess: () => {
      toast.success('Password changed')
      setPwForm({ current_password: '', new_password: '', confirm_password: '' })
    },
    onError: (err) => {
      const detail = err.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Failed to change password')
    },
  })

  function handleProfileSubmit(e) {
    e.preventDefault()
    const payload = {}
    if (profileForm.full_name !== user.full_name) payload.full_name = profileForm.full_name
    if (profileForm.email !== user.email) payload.email = profileForm.email
    if (Object.keys(payload).length === 0) { toast('No changes to save'); return }
    profileMutation.mutate(payload)
  }

  function handlePasswordSubmit(e) {
    e.preventDefault()
    if (!isPasswordStrong(pwForm.new_password)) {
      toast.error('Please meet all password requirements before continuing')
      return
    }
    if (pwForm.new_password !== pwForm.confirm_password) {
      toast.error('Passwords do not match')
      return
    }
    passwordMutation.mutate(pwForm)
  }

  if (isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 256 }}>
      <Spinner size="lg" />
    </div>
  )

  return (
    // Escape the parent's dark bg + padding to apply light background
    <div style={{ padding: '2rem 1.5rem', minHeight: '100vh', background: t.bg, fontFamily: t.fontBody }}>

      <h1 style={{ fontFamily: t.fontDisplay, fontWeight: 800, fontSize: 26, color: t.ink, marginBottom: 24 }}>
        Profile
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 24, alignItems: 'start' }}>

        {/* ── Account details ───────────────────────────────────── */}
        <div style={cardStyle}>
          <h2 style={{ fontFamily: t.fontDisplay, fontWeight: 700, fontSize: 16, color: t.ink, marginBottom: 20 }}>
            Account details
          </h2>
          <form onSubmit={handleProfileSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Full name</label>
              <input
                style={inputStyle}
                type="text"
                value={profileForm.full_name}
                onChange={e => setProfileForm(f => ({ ...f, full_name: e.target.value }))}
                required
                onFocus={e => { e.target.style.borderColor = t.violet }}
                onBlur={e => { e.target.style.borderColor = t.border }}
              />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input
                style={inputStyle}
                type="email"
                value={profileForm.email}
                onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))}
                required
                onFocus={e => { e.target.style.borderColor = t.violet }}
                onBlur={e => { e.target.style.borderColor = t.border }}
              />
            </div>
            <div>
              <button
                type="submit"
                disabled={profileMutation.isPending}
                style={{
                  background: t.violet, color: '#FFFFFF',
                  border: 'none', borderRadius: 8, padding: '10px 20px',
                  fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 14,
                  cursor: profileMutation.isPending ? 'not-allowed' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  opacity: profileMutation.isPending ? 0.7 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                {profileMutation.isPending && <Spinner size="sm" className="text-white" />}
                {profileMutation.isPending ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>

        {/* ── Change password ────────────────────────────────────── */}
        <div style={cardStyle}>
          <h2 style={{ fontFamily: t.fontDisplay, fontWeight: 700, fontSize: 16, color: t.ink, marginBottom: 20 }}>
            Change password
          </h2>
          <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Current password</label>
              <div style={{ position: 'relative' }}>
                <input
                  style={{ ...inputStyle, paddingRight: 42 }}
                  type={showCurrent ? 'text' : 'password'}
                  value={pwForm.current_password}
                  onChange={e => setPwForm(f => ({ ...f, current_password: e.target.value }))}
                  required
                  onFocus={e => { e.target.style.borderColor = t.violet }}
                  onBlur={e => { e.target.style.borderColor = t.border }}
                />
                <button type="button" onClick={() => setShowCurrent(v => !v)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: t.inkLight, display: 'flex', alignItems: 'center', padding: 0 }}>
                  {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label style={labelStyle}>New password</label>
              <div style={{ position: 'relative' }}>
                <input
                  style={{ ...inputStyle, paddingRight: 42 }}
                  type={showNew ? 'text' : 'password'}
                  value={pwForm.new_password}
                  onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))}
                  required
                  onFocus={e => { e.target.style.borderColor = t.violet }}
                  onBlur={e => { e.target.style.borderColor = t.border }}
                />
                <button type="button" onClick={() => setShowNew(v => !v)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: t.inkLight, display: 'flex', alignItems: 'center', padding: 0 }}>
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {pwForm.new_password && (
                <ul style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {PASSWORD_RULES.map(({ label, test }) => {
                    const met = test(pwForm.new_password)
                    return (
                      <li key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontFamily: t.fontBody, color: met ? '#059669' : t.inkLight, listStyle: 'none' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{met ? '✓' : '✗'}</span>
                        {label}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div>
              <label style={labelStyle}>Confirm new password</label>
              <div style={{ position: 'relative' }}>
                <input
                  style={{ ...inputStyle, paddingRight: 42 }}
                  type={showConfirm ? 'text' : 'password'}
                  value={pwForm.confirm_password}
                  onChange={e => setPwForm(f => ({ ...f, confirm_password: e.target.value }))}
                  required
                  onFocus={e => { e.target.style.borderColor = t.violet }}
                  onBlur={e => { e.target.style.borderColor = t.border }}
                />
                <button type="button" onClick={() => setShowConfirm(v => !v)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: t.inkLight, display: 'flex', alignItems: 'center', padding: 0 }}>
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={passwordMutation.isPending}
                style={{
                  background: t.violet, color: '#FFFFFF',
                  border: 'none', borderRadius: 8, padding: '10px 20px',
                  fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 14,
                  cursor: passwordMutation.isPending ? 'not-allowed' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  opacity: passwordMutation.isPending ? 0.7 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                {passwordMutation.isPending && <Spinner size="sm" className="text-white" />}
                {passwordMutation.isPending ? 'Updating…' : 'Update password'}
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  )
}
