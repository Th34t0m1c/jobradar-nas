import { useState } from 'react'
import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom'
import { LayoutGrid, FileText, SlidersHorizontal, LogOut, User, Menu, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../context/useAuth'
import { cvApi, authApi } from '../../api/client'
import { useIsMobile } from '../../utils/useIsMobile'
import { Spinner } from '../ui'

const NAV_ALL = [
  { to: '/dashboard', icon: LayoutGrid, label: 'Dashboard' },
  { to: '/cv',        icon: FileText,          label: 'CV' },
  { to: '/filters',   icon: SlidersHorizontal, label: 'Filters' },
  { to: '/profile',   icon: User,              label: 'Profile' },
]

const NAV_NO_CV = [
  { to: '/cv', icon: FileText, label: 'CV' },
]

function getInitials(name) {
  if (!name) return '?'
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

function LogoIcon() {
  const dots = []
  const xs = [7, 12, 17, 22]
  const ys = [7, 12, 17, 22]
  for (const x of xs) {
    for (const y of ys) {
      const dist = Math.sqrt((x - 17) ** 2 + (y - 7) ** 2)
      const opacity = x === 17 && y === 7 ? 1 : Math.max(0.18, 0.85 - dist / 18)
      const r = x === 17 && y === 7 ? 2.4 : 1.7
      dots.push(<circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={`rgba(255,255,255,${opacity})`} />)
    }
  }
  return (
    <svg width="30" height="30" viewBox="0 0 28 28" fill="none">
      <rect width="28" height="28" rx="7" fill="#7C3AED" />
      {dots}
    </svg>
  )
}

function navItemStyle({ isActive }) {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: `8px 14px 8px ${isActive ? 11 : 14}px`,
    borderRadius: 8,
    borderLeft: `3px solid ${isActive ? '#7C3AED' : 'transparent'}`,
    background: isActive ? 'rgba(124,58,237,0.13)' : 'transparent',
    color: isActive ? '#A78BFA' : '#6B7280',
    fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
    fontWeight: isActive ? 600 : 500,
    fontSize: 13.5,
    textDecoration: 'none',
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
    userSelect: 'none',
  }
}

export default function AppLayout() {
  const { logout } = useAuth()
  const isMobile = useIsMobile()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const { data: cvVersions = [], isLoading: cvLoading } = useQuery({
    queryKey: ['cv'],
    queryFn: () => cvApi.list().then(r => r.data),
    staleTime: 60_000,
  })

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: () => authApi.me().then(r => r.data),
    staleTime: 300_000,
  })

  const activeCV = cvVersions.find(v => v.is_active)
  const hasCV = !!activeCV?.summary?.trim()
  const nav = hasCV ? NAV_ALL : NAV_NO_CV

  // Wait for CV query before deciding — avoids flash redirect on page load
  if (cvLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#F5F4F0' }}>
        <Spinner size="lg" />
      </div>
    )
  }

  // Gate all routes except /cv until an active CV with a summary exists
  if (!hasCV && !location.pathname.startsWith('/cv')) {
    return <Navigate to="/cv" replace />
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* ── Mobile top bar ───────────────────────────────────────────── */}
      {isMobile && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0,
          height: 56, zIndex: 45,
          background: '#0D0E14',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center',
          padding: '0 16px', gap: 14,
        }}>
          <button
            onClick={() => setSidebarOpen(v => !v)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#9CA3AF', padding: 4, display: 'flex', alignItems: 'center',
            }}
          >
            <Menu size={22} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LogoIcon />
            <span style={{
              fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
              fontWeight: 700, fontSize: 15.5, letterSpacing: '-0.01em',
            }}>
              <span style={{ color: '#F9FAFB' }}>Job</span>
              <span style={{ color: '#7C3AED' }}>Radar</span>
            </span>
          </div>
        </div>
      )}

      {/* ── Backdrop (mobile only, when sidebar open) ─────────────────── */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 40,
          }}
        />
      )}

      {/* ── Sidebar ───────────────────────────────────────────────────── */}
      <aside style={{
        ...(isMobile ? {
          position: 'fixed', top: 0, left: 0, bottom: 0,
          width: 220, zIndex: 50,
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-220px)',
          transition: 'transform 0.25s ease',
        } : {
          width: 220, flexShrink: 0, position: 'relative',
        }),
        display: 'flex',
        flexDirection: 'column',
        background: '#0D0E14',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        height: '100vh',
      }}>

        {/* Logo */}
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <LogoIcon />
            <span style={{
              fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
              fontWeight: 700,
              fontSize: 15.5,
              letterSpacing: '-0.01em',
              color: '#F9FAFB',
            }}>
              <span style={{ color: '#F9FAFB' }}>Job</span>
              <span style={{ color: '#7C3AED' }}>Radar</span>
            </span>
            {/* Close button — mobile only */}
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(false)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#6B7280', padding: 2, display: 'flex', alignItems: 'center',
                  marginLeft: 'auto',
                }}
              >
                <X size={18} />
              </button>
            )}
          </div>
          <p style={{
            fontSize: 11,
            color: '#374151',
            fontFamily: '"Inter", system-ui, sans-serif',
            marginTop: 4,
            paddingLeft: 40,
          }}>
            AI Job Aggregator
          </p>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to + label}
              to={to}
              style={navItemStyle}
              end={to === '/dashboard'}
              onClick={isMobile ? () => setSidebarOpen(false) : undefined}
            >
              {({ isActive }) => (
                <>
                  <Icon size={16} style={{ flexShrink: 0, color: isActive ? '#A78BFA' : '#4B5563' }} />
                  <span style={{ flex: 1 }}>{label}</span>
                </>
              )}
            </NavLink>
          ))}

          {!hasCV && (
            <p style={{
              padding: '12px 14px 0',
              fontSize: 11.5,
              color: '#374151',
              fontFamily: '"Inter", system-ui, sans-serif',
              lineHeight: 1.6,
            }}>
              {activeCV
                ? 'Save an AI summary in CV settings to unlock Jobs and Filters'
                : 'Upload a CV to unlock Jobs and Filters'}
            </p>
          )}
        </nav>

        {/* Footer — user + logout */}
        <div style={{ padding: '10px 8px 14px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {user && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 8,
              marginBottom: 4,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'rgba(124,58,237,0.2)',
                border: '1.5px solid rgba(124,58,237,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  color: '#A78BFA',
                  fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
                  lineHeight: 1,
                }}>
                  {getInitials(user.full_name)}
                </span>
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{
                  fontSize: 12.5, fontWeight: 600,
                  color: '#E5E7EB',
                  fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  lineHeight: 1.3,
                }}>
                  {user.full_name}
                </p>
                <p style={{
                  fontSize: 11, color: '#4B5563',
                  fontFamily: '"Inter", system-ui, sans-serif',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {user.email}
                </p>
              </div>
            </div>
          )}

          <button
            onClick={logout}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '7px 14px',
              borderRadius: 8, border: 'none',
              background: 'transparent',
              color: '#4B5563',
              fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
              fontWeight: 500, fontSize: 13.5,
              cursor: 'pointer',
              width: '100%',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.07)' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#4B5563'; e.currentTarget.style.background = 'transparent' }}
          >
            <LogOut size={16} style={{ flexShrink: 0 }} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <main style={{
        flex: 1,
        overflowY: 'auto',
        background: '#F5F4F0',
        ...(isMobile ? { paddingTop: 56 } : {}),
      }}>
        <Outlet />
      </main>
    </div>
  )
}
