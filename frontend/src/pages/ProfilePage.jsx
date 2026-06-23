import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../api/client'
import { Spinner, SectionHeader, PasswordRules, isPasswordStrong } from '../components/ui'
import { Eye, EyeOff, User, Lock, Mail, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDate } from '../utils/helpers'

function getInitials(name) {
  if (!name) return '?'
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

export default function ProfilePage() {
  const queryClient = useQueryClient()

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
      toast.error('Password does not meet the requirements')
      return
    }
    if (pwForm.new_password !== pwForm.confirm_password) {
      toast.error('Passwords do not match')
      return
    }
    passwordMutation.mutate(pwForm)
  }

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Spinner size="lg" />
    </div>
  )

  return (
    <div className="page-enter max-w-xl">
      <SectionHeader title="Profile" subtitle="Manage your account information" />

      {/* Avatar */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-full bg-signal-muted border-2 border-signal/30 flex items-center justify-center flex-shrink-0">
          <span className="text-xl font-display font-bold text-signal">
            {getInitials(user?.full_name)}
          </span>
        </div>
        <div>
          <p className="font-display font-bold text-white text-lg">{user?.full_name}</p>
          <div className="flex items-center gap-1.5 mt-0.5 text-slate-500 text-xs font-body">
            <Calendar className="w-3 h-3" />
            <span>Member since {formatDate(user?.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Profile info */}
      <div className="card p-6 mb-4">
        <h3 className="font-display font-semibold text-white text-sm mb-5 flex items-center gap-2">
          <User className="w-4 h-4 text-signal" />
          Account Details
        </h3>
        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div>
            <label className="label">Full Name</label>
            <input
              className="input"
              type="text"
              value={profileForm.full_name}
              onChange={e => setProfileForm(f => ({ ...f, full_name: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label flex items-center gap-1.5">
              <Mail className="w-3 h-3" /> Email
            </label>
            <input
              className="input"
              type="email"
              value={profileForm.email}
              onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))}
              required
            />
          </div>
          <button
            type="submit"
            disabled={profileMutation.isPending}
            className="btn-primary flex items-center gap-2"
          >
            {profileMutation.isPending && <Spinner size="sm" />}
            {profileMutation.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </div>

      {/* Change password */}
      <div className="card p-6">
        <h3 className="font-display font-semibold text-white text-sm mb-5 flex items-center gap-2">
          <Lock className="w-4 h-4 text-signal" />
          Change Password
        </h3>
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="label">Current Password</label>
            <div className="relative">
              <input
                className="input pr-10"
                type={showCurrent ? 'text' : 'password'}
                value={pwForm.current_password}
                onChange={e => setPwForm(f => ({ ...f, current_password: e.target.value }))}
                required
              />
              <button type="button" onClick={() => setShowCurrent(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="label">New Password</label>
            <div className="relative">
              <input
                className="input pr-10"
                type={showNew ? 'text' : 'password'}
                placeholder="Strong password"
                value={pwForm.new_password}
                onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))}
                required
              />
              <button type="button" onClick={() => setShowNew(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <PasswordRules password={pwForm.new_password} />
          </div>
          <div>
            <label className="label">Confirm New Password</label>
            <div className="relative">
              <input
                className="input pr-10"
                type={showConfirm ? 'text' : 'password'}
                placeholder="••••••••"
                value={pwForm.confirm_password}
                onChange={e => setPwForm(f => ({ ...f, confirm_password: e.target.value }))}
                required
              />
              <button type="button" onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={passwordMutation.isPending}
            className="btn-primary flex items-center gap-2"
          >
            {passwordMutation.isPending && <Spinner size="sm" />}
            {passwordMutation.isPending ? 'Changing…' : 'Change password'}
          </button>
        </form>
      </div>
    </div>
  )
}
