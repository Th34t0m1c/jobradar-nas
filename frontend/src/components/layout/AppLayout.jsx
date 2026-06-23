import { NavLink, Outlet, Link } from 'react-router-dom'
import {
  LayoutGrid, FileText, SlidersHorizontal, LogOut, Radio, ChevronRight
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../context/useAuth'
import { cvApi, authApi } from '../../api/client'

const NAV_ALL = [
  { to: '/dashboard', icon: LayoutGrid, label: 'Jobs' },
  { to: '/cv', icon: FileText, label: 'CV' },
  { to: '/filters', icon: SlidersHorizontal, label: 'Filters' },
]

const NAV_NO_CV = [
  { to: '/cv', icon: FileText, label: 'CV' },
]

function getInitials(name) {
  if (!name) return '?'
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')
}

export default function AppLayout() {
  const { logout } = useAuth()

  const { data: cvVersions = [] } = useQuery({
    queryKey: ['cv'],
    queryFn: () => cvApi.list().then(r => r.data),
    staleTime: 60_000,
  })

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: () => authApi.me().then(r => r.data),
    staleTime: 300_000,
  })

  const hasCV = cvVersions.length > 0
  const nav = hasCV ? NAV_ALL : NAV_NO_CV

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 flex flex-col bg-ink-900 border-r border-white/5">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-signal-muted border border-signal/30 flex items-center justify-center">
              <Radio className="w-3.5 h-3.5 text-signal" />
            </div>
            <span className="font-display font-bold text-white text-base tracking-tight">
              JobRadar
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-1 font-body">AI Job Aggregator</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `nav-item group ${isActive ? 'active' : ''}`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{label}</span>
              <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity" />
            </NavLink>
          ))}
          {!hasCV && (
            <p className="px-3 pt-3 text-xs text-slate-600 font-body leading-relaxed">
              Upload a CV to unlock Jobs and Filters
            </p>
          )}
        </nav>

        {/* Footer — user info + logout */}
        <div className="px-3 py-4 border-t border-white/5 space-y-3">
          {user && (
            <Link
              to="/profile"
              className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors group"
            >
              <div className="w-7 h-7 rounded-full bg-signal-muted border border-signal/30 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-display font-bold text-signal leading-none">
                  {getInitials(user.full_name)}
                </span>
              </div>
              <p className="text-xs font-body font-medium text-slate-300 truncate leading-tight group-hover:text-white transition-colors">
                {user.full_name}
              </p>
            </Link>
          )}
          <button
            onClick={logout}
            className="nav-item w-full hover:text-red-400 hover:bg-red-500/8"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-ink-950 bg-grid-pattern bg-grid">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
