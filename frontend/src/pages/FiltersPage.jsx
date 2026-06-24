import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { filtersApi, platformsApi, cvApi } from '../api/client'
import { Spinner } from '../components/ui'
import { Plus, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useIsMobile } from '../utils/useIsMobile'

const t = {
  violet: '#7C3AED', violetLight: '#EDE9FE',
  bg: '#F5F4F0', surface: '#FFFFFF', border: '#E4E2DC',
  ink: '#18181B', inkMid: '#52525B', inkLight: '#A1A1AA',
  red: '#DC2626',
  fontDisplay: '"Plus Jakarta Sans", system-ui, sans-serif',
  fontBody: '"Inter", system-ui, sans-serif',
}

// Master metadata for all known platforms (label + color)
const PLATFORM_META = {
  weworkremotely: { label: 'We Work Remotely', color: '#F97316' },
  himalayas:      { label: 'Himalayas',        color: '#38BDF8' },
  arcdev:         { label: 'Arc.dev',           color: '#A855F7' },
  remoteok:       { label: 'RemoteOK',          color: '#4ADE80' },
  workingnomads:  { label: 'Working Nomads',    color: '#2DD4BF' },
  empllo:         { label: 'Empllo',            color: '#EC4899' },
  remotive:       { label: 'Remotive',          color: '#818CF8' },
  arbeitnow:      { label: 'Arbeitnow',         color: '#FACC15' },
  jobicy:         { label: 'Jobicy',            color: '#FB7185' },
}

const EXP_LEVELS = ['junior', 'mid', 'senior']
const LOCATION_TYPES = ['remote', 'hybrid', 'onsite']
const REGIONS = ['Anywhere', 'Asia', 'Europe', 'North America', 'Japan']

// ── Toggle switch ────────────────────────────────────────────────────────────

function Toggle({ on, onToggle }) {
  return (
    <div
      onClick={onToggle}
      style={{
        width: 44, height: 24, borderRadius: 12, flexShrink: 0,
        background: on ? t.violet : '#D1D5DB',
        cursor: 'pointer', position: 'relative',
        transition: 'background 0.2s',
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: '50%',
        background: '#fff',
        position: 'absolute', top: 3,
        left: on ? 23 : 3,
        transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
      }} />
    </div>
  )
}

// ── Tag Input ────────────────────────────────────────────────────────────────

function TagInput({ values = [], onChange, placeholder, suggestions = [] }) {
  const [input, setInput] = useState('')

  function add(val) {
    const v = val.trim()
    if (v && !values.includes(v)) onChange([...values, v])
    setInput('')
  }

  function remove(v) { onChange(values.filter(x => x !== v)) }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {values.map(v => (
          <span key={v} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: t.violetLight, color: t.violet,
            borderRadius: 6, padding: '3px 10px',
            fontSize: 13, fontFamily: t.fontBody, fontWeight: 500,
          }}>
            {v}
            <button onClick={() => remove(v)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: t.violet, padding: 0, lineHeight: 1, display: 'flex', alignItems: 'center',
            }}>
              <X style={{ width: 12, height: 12 }} />
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          style={{
            flex: 1, padding: '8px 12px', fontSize: 13,
            background: t.surface, border: `1px solid ${t.border}`,
            borderRadius: 8, color: t.ink, fontFamily: t.fontBody, outline: 'none',
          }}
          placeholder={placeholder}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(input) } }}
        />
        <button onClick={() => add(input)} style={{
          background: t.violet, color: '#fff', border: 'none',
          borderRadius: 8, padding: '8px 16px', cursor: 'pointer',
          fontFamily: t.fontBody, fontSize: 13, fontWeight: 600,
        }}>
          Add
        </button>
      </div>
      {suggestions.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <p style={{ fontSize: 11, color: t.inkLight, fontFamily: t.fontBody, margin: '0 0 6px 0', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
            Suggested from your CV
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {suggestions.filter(s => !values.includes(s)).map(s => (
              <button key={s} onClick={() => onChange([...values, s])} style={{
                background: 'none', border: `1px solid ${t.border}`,
                borderRadius: 6, padding: '2px 10px', cursor: 'pointer',
                fontSize: 12, color: t.inkMid, fontFamily: t.fontBody,
              }}>
                + {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Toggle Group ─────────────────────────────────────────────────────────────

function ToggleGroup({ options, values = [], onChange }) {
  function toggle(v) {
    if (values.includes(v)) onChange(values.filter(x => x !== v))
    else onChange([...values, v])
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map(o => {
        const active = values.includes(o)
        return (
          <button key={o} onClick={() => toggle(o)} style={{
            padding: '7px 16px', borderRadius: 8, cursor: 'pointer',
            fontSize: 13, fontFamily: t.fontBody, fontWeight: 500,
            textTransform: 'capitalize', transition: 'all 0.15s',
            background: active ? t.violetLight : t.surface,
            border: active ? `1.5px solid ${t.violet}` : `1.5px solid ${t.border}`,
            color: active ? t.violet : t.inkMid,
          }}>
            {o}
          </button>
        )
      })}
    </div>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const cardStyle = {
  background: t.surface, border: `1px solid ${t.border}`,
  borderRadius: 12, padding: 24,
}
const cardHeadingStyle = {
  fontFamily: t.fontDisplay, fontSize: 15, fontWeight: 600,
  color: t.ink, margin: '0 0 4px 0',
}
const cardSubStyle = {
  fontFamily: t.fontBody, fontSize: 12, color: t.inkLight, margin: '0 0 16px 0',
}
const hintStyle = { fontFamily: t.fontBody, fontSize: 12, color: t.inkLight, marginTop: 8 }

// ── Page ─────────────────────────────────────────────────────────────────────

export default function FiltersPage() {
  const queryClient = useQueryClient()
  const isMobile = useIsMobile()

  // Fetch active platforms from backend; fall back to full list if the request fails
  const { data: platformsData, isLoading: platformsLoading } = useQuery({
    queryKey: ['platforms'],
    queryFn: () => platformsApi.list().then(r => r.data),
    retry: 1,
  })

  const ALL_PLATFORMS = (platformsData ?? Object.keys(PLATFORM_META).map(key => ({ key, is_active: true })))
    .filter(p => p.is_active)
    .map(p => ({ key: p.key, ...PLATFORM_META[p.key] }))
    .filter(p => p.label)
  const ALL_PLATFORM_KEYS = ALL_PLATFORMS.map(p => p.key)

  const [form, setForm] = useState({
    role_titles: [], experience_level: [], location_type: [],
    location_region: [], tech_stack: [],
    min_score_threshold: 0, max_age_hours: '',
    enabled_platforms: [],  // populated after platforms load
  })

  const { data, isLoading } = useQuery({
    queryKey: ['filters'],
    queryFn: () => filtersApi.get().then(r => r.data).catch(() => null),
  })

  const { data: suggestions } = useQuery({
    queryKey: ['cv', 'suggestions'],
    queryFn: () => cvApi.getSuggestions().then(r => r.data),
    staleTime: 5 * 60_000,
  })

  useEffect(() => {
    if (!data || ALL_PLATFORM_KEYS.length === 0) return
    setForm({
      role_titles:          data.role_titles || [],
      experience_level:     data.experience_level || [],
      location_type:        data.location_type || [],
      location_region:      data.location_region || [],
      tech_stack:           data.tech_stack || [],
      min_score_threshold:  data.min_score_threshold || 0,
      max_age_hours:        data.max_age_hours ?? '',
      // null from DB → all active platforms enabled; strip any inactive keys from saved list
      enabled_platforms:    data.enabled_platforms
        ? data.enabled_platforms.filter(k => ALL_PLATFORM_KEYS.includes(k))
        : ALL_PLATFORM_KEYS,
    })
  }, [data, ALL_PLATFORM_KEYS.join(',')])

  const saveMutation = useMutation({
    mutationFn: () => filtersApi.save({
      ...form,
      max_age_hours: form.max_age_hours === '' ? null : Number(form.max_age_hours),
      // all platforms selected → send null (no restriction); partial list → send the list
      enabled_platforms: form.enabled_platforms.length === ALL_PLATFORM_KEYS.length ? null : form.enabled_platforms,
    }),
    onSuccess: () => {
      toast.success('Filters saved')
      queryClient.invalidateQueries(['filters'])
    },
    onError: () => toast.error('Save failed'),
  })

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  function isPlatformEnabled(key) {
    return form.enabled_platforms.includes(key)
  }

  function togglePlatform(key) {
    if (form.enabled_platforms.includes(key))
      set('enabled_platforms', form.enabled_platforms.filter(k => k !== key))
    else
      set('enabled_platforms', [...form.enabled_platforms, key])
  }

  const enabledCount = form.enabled_platforms.length

  if (isLoading || platformsLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Spinner />
      </div>
    )
  }

  return (
    <div className="page-enter" style={{ padding: '2rem 1.5rem', minHeight: '100vh', background: t.bg }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: t.fontDisplay, fontSize: 26, fontWeight: 700, color: t.ink, margin: '0 0 6px 0' }}>
            Job Filters
          </h1>
          <p style={{ fontFamily: t.fontBody, fontSize: 14, color: t.inkMid, margin: 0 }}>
            Define your preferences — only matching jobs are fetched and saved to your board
          </p>
        </div>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          style={{
            background: t.violet, color: '#fff', border: 'none',
            borderRadius: 8, padding: '10px 22px', cursor: saveMutation.isPending ? 'not-allowed' : 'pointer',
            fontFamily: t.fontBody, fontSize: 14, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 8,
            opacity: saveMutation.isPending ? 0.7 : 1, flexShrink: 0, marginLeft: 24,
          }}
        >
          {saveMutation.isPending && <Spinner size="sm" />}
          Save Filters
        </button>
      </div>

      {/* Two-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 16, alignItems: 'start' }}>

        {/* LEFT — Platforms */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <h3 style={{ ...cardHeadingStyle, margin: 0 }}>Platforms</h3>
            <span style={{ fontSize: 12, color: t.inkLight, fontFamily: t.fontBody }}>
              {enabledCount} of {ALL_PLATFORMS.length} active
            </span>
          </div>
          <p style={cardSubStyle}>Toggle which job boards the scrapers pull from.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {ALL_PLATFORMS.map((platform, i) => (
              <div
                key={platform.key}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 0',
                  borderBottom: i < ALL_PLATFORMS.length - 1 ? `1px solid ${t.border}` : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: isPlatformEnabled(platform.key) ? platform.color : t.inkLight,
                    transition: 'background 0.2s',
                  }} />
                  <span style={{
                    fontSize: 14, fontFamily: t.fontBody, fontWeight: 500,
                    color: isPlatformEnabled(platform.key) ? t.ink : t.inkLight,
                    transition: 'color 0.2s',
                  }}>
                    {platform.label}
                  </span>
                </div>
                <Toggle on={isPlatformEnabled(platform.key)} onToggle={() => togglePlatform(platform.key)} />
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — stacked */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Minimum Score */}
          <div style={cardStyle}>
            <h3 style={cardHeadingStyle}>Minimum match score</h3>
            <p style={cardSubStyle}>Jobs below this threshold are hidden from your board.</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                type="range" min="0" max="100" step="5"
                value={form.min_score_threshold}
                onChange={e => set('min_score_threshold', Number(e.target.value))}
                style={{ flex: 1, accentColor: t.violet }}
              />
              <span style={{
                fontFamily: t.fontBody, fontSize: 14, fontWeight: 700,
                color: t.violet, minWidth: 44, textAlign: 'right',
              }}>
                {form.min_score_threshold}%
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ fontSize: 11, color: t.inkLight, fontFamily: t.fontBody }}>0 — show all</span>
              <span style={{ fontSize: 11, color: t.inkLight, fontFamily: t.fontBody }}>100 — only perfect matches</span>
            </div>
          </div>

          {/* Work type (location_type) */}
          <div style={cardStyle}>
            <h3 style={cardHeadingStyle}>Work type</h3>
            <p style={cardSubStyle}>Filter by where the job is located.</p>
            {LOCATION_TYPES.map(lt => {
              const labels = { remote: 'Remote only', hybrid: 'Hybrid roles', onsite: 'On-site only' }
              const descs  = { remote: 'Include fully remote positions', hybrid: 'Include partial in-office positions', onsite: 'Include office-based positions' }
              const on = form.location_type.length === 0 || form.location_type.includes(lt)
              return (
                <div key={lt} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: lt !== 'onsite' ? `1px solid ${t.border}` : 'none',
                }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 500, color: t.ink, fontFamily: t.fontBody, margin: 0 }}>{labels[lt]}</p>
                    <p style={{ fontSize: 12, color: t.inkLight, fontFamily: t.fontBody, margin: 0 }}>{descs[lt]}</p>
                  </div>
                  <Toggle
                    on={form.location_type.includes(lt)}
                    onToggle={() => {
                      if (form.location_type.includes(lt)) set('location_type', form.location_type.filter(x => x !== lt))
                      else set('location_type', [...form.location_type, lt])
                    }}
                  />
                </div>
              )
            })}
          </div>

          {/* Role keywords */}
          <div style={cardStyle}>
            <h3 style={cardHeadingStyle}>Role keywords</h3>
            <p style={cardSubStyle}>Jobs are only fetched when these terms appear in the title.</p>
            <TagInput
              values={form.role_titles}
              onChange={v => set('role_titles', v)}
              placeholder="Add keyword…"
              suggestions={suggestions?.role_titles ?? []}
            />
          </div>

          {/* Experience level */}
          <div style={cardStyle}>
            <h3 style={cardHeadingStyle}>Experience Level</h3>
            <ToggleGroup options={EXP_LEVELS} values={form.experience_level} onChange={v => set('experience_level', v)} />
            <p style={hintStyle}>
              {form.experience_level.length === 0 ? 'No filter — all levels included' : `Showing: ${form.experience_level.join(', ')}`}
            </p>
          </div>
        </div>
      </div>

      {/* Full-width: Tech Stack */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <h3 style={cardHeadingStyle}>Required tech stack</h3>
        <p style={cardSubStyle}>Only show jobs that mention at least one of these technologies.</p>
        <TagInput
          values={form.tech_stack}
          onChange={v => set('tech_stack', v)}
          placeholder="Add technology…"
          suggestions={suggestions?.tech_stack ?? []}
        />
      </div>

      {/* Full-width: Location Region + Max Age */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
        <div style={cardStyle}>
          <h3 style={cardHeadingStyle}>Location Region</h3>
          <p style={cardSubStyle}>Filter jobs by geographic region.</p>
          <TagInput values={form.location_region} onChange={v => set('location_region', v)} placeholder="e.g. Japan" suggestions={REGIONS} />
        </div>

        <div style={cardStyle}>
          <h3 style={cardHeadingStyle}>Posted Within (hours)</h3>
          <p style={cardSubStyle}>Only save jobs posted within this time window.</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="number" min="1" placeholder="e.g. 72"
              value={form.max_age_hours}
              onChange={e => {
                const v = e.target.value
                set('max_age_hours', v === '' ? '' : Math.max(1, parseInt(v, 10) || 1))
              }}
              style={{
                width: 120, padding: '8px 12px', fontSize: 13,
                background: t.surface, border: `1px solid ${t.border}`,
                borderRadius: 8, color: t.ink, fontFamily: t.fontBody, outline: 'none',
              }}
            />
            <span style={{ fontFamily: t.fontBody, fontSize: 13, color: t.inkMid }}>hours</span>
            {form.max_age_hours !== '' && (
              <button onClick={() => set('max_age_hours', '')} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12, color: t.inkLight, fontFamily: t.fontBody, padding: 0,
              }}>
                Clear
              </button>
            )}
          </div>
          <p style={hintStyle}>
            {form.max_age_hours ? `Only jobs posted in the last ${form.max_age_hours}h are saved and shown` : 'No limit — all jobs within the fetch window are included'}
          </p>
        </div>
      </div>
    </div>
  )
}
