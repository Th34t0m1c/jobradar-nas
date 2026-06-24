import { formatDistanceToNow, format } from 'date-fns'

// ── Avatar ─────────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ['#7C3AED', '#2563EB', '#059669', '#D97706', '#DC2626', '#DB2777', '#0891B2']
export function getAvatarBg(name) {
  if (!name) return AVATAR_COLORS[0]
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

// ── Score color (hex, for inline styles) ──────────────────────────────────────
export function scoreHexColor(score) {
  if (score == null) return '#A1A1AA'
  if (score >= 80) return '#059669'
  if (score >= 60) return '#D97706'
  return '#DC2626'
}

// ── Platform dot colors ────────────────────────────────────────────────────────
export const PLATFORM_DOT_COLORS = {
  weworkremotely: '#F97316',
  himalayas:      '#38BDF8',
  arcdev:         '#A855F7',
  remoteok:       '#4ADE80',
  workingnomads:  '#2DD4BF',
  empllo:         '#EC4899',
  remotive:       '#818CF8',
  arbeitnow:      '#FACC15',
  jobicy:         '#FB7185',
}

export const STATUS_CONFIG = {
  new: { label: 'New', classes: 'bg-signal-muted text-signal border border-signal/20' },
  interested: { label: 'Interested', classes: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' },
  applied: { label: 'Applied', classes: 'bg-violet-500/10 text-violet-400 border border-violet-500/20' },
  skipped: { label: 'Skipped', classes: 'bg-white/5 text-slate-500 border border-white/10' },
}

export const PLATFORM_CONFIG = {
  weworkremotely: { label: 'We Work Remotely', short: 'WWR', color: 'text-orange-400' },
  himalayas:      { label: 'Himalayas',         short: 'HIM', color: 'text-sky-400' },
  arcdev:         { label: 'Arc.dev',            short: 'ARC', color: 'text-purple-400' },
  remoteok:       { label: 'RemoteOK',           short: 'ROK', color: 'text-green-400' },
  workingnomads:  { label: 'Working Nomads',     short: 'WN',  color: 'text-teal-400' },
  empllo:         { label: 'Empllo',             short: 'EMP', color: 'text-pink-400' },
  remotive:       { label: 'Remotive',           short: 'RMT', color: 'text-indigo-400' },
  arbeitnow:      { label: 'Arbeitnow',          short: 'ABN', color: 'text-yellow-400' },
  jobicy:         { label: 'Jobicy',             short: 'JBC', color: 'text-rose-400' },
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
  } catch {
    return '—'
  }
}

export function formatDateFull(dateStr) {
  if (!dateStr) return '—'
  try {
    return format(new Date(dateStr), 'MMM d, yyyy · HH:mm')
  } catch {
    return '—'
  }
}

export function getPlatformLabel(platform) {
  return PLATFORM_CONFIG[platform]?.label || platform
}
