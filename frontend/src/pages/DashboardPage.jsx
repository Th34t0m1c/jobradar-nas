import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { jobsApi } from '../api/client'
import { ConfirmDialog, Spinner } from '../components/ui'
import { formatDate, getPlatformLabel, PLATFORM_CONFIG, getAvatarBg, scoreHexColor, PLATFORM_DOT_COLORS } from '../utils/helpers'
import { useIsMobile } from '../utils/useIsMobile'
import {
  Play, Trash2, Eye,
  ChevronLeft, ChevronRight, X, Eraser,
} from 'lucide-react'
import toast from 'react-hot-toast'

const t = {
  violet: '#7C3AED', violetLight: '#EDE9FE',
  bg: '#F5F4F0', surface: '#FFFFFF', border: '#E4E2DC',
  ink: '#18181B', inkMid: '#52525B', inkLight: '#A1A1AA',
  red: '#DC2626',
  fontDisplay: '"Plus Jakarta Sans", system-ui, sans-serif',
  fontBody: '"Inter", system-ui, sans-serif',
}


const PAGE_SIZES = [20, 50, 100]
const SORT_OPTIONS = [
  { value: 'fetched_at', label: 'Date Fetched' },
  { value: 'score',      label: 'Score' },
  { value: 'posted_at',  label: 'Date Posted' },
  { value: 'platform',   label: 'Platform' },
  { value: 'title',      label: 'Title' },
]
const STATUS_TABS = [
  { value: '',          label: 'All' },
  { value: 'new',       label: 'New' },
  { value: 'interested',label: 'Interested' },
  { value: 'applied',   label: 'Applied' },
  { value: 'skipped',   label: 'Skipped' },
]

function scoreColor(score) {
  if (score == null) return null
  return scoreHexColor(score)
}

function StatusPill({ status }) {
  const cfg = {
    new:       { bg: '#F4F4F5', color: '#52525B', label: 'New' },
    interested:{ bg: '#EFF6FF', color: '#2563EB', label: 'Interested' },
    applied:   { bg: '#ECFDF5', color: '#059669', label: 'Applied' },
    skipped:   { bg: '#F4F4F5', color: '#A1A1AA', label: 'Skipped' },
  }[status] || { bg: '#F4F4F5', color: '#52525B', label: status || 'New' }
  return (
    <span style={{
      background: cfg.bg, color: cfg.color, borderRadius: 20,
      padding: '3px 10px', fontSize: 12, fontWeight: 500,
      fontFamily: t.fontBody, whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  )
}

const inputStyle = {
  border: `1px solid ${t.border}`, borderRadius: 8,
  padding: '7px 11px', fontSize: 13, fontFamily: t.fontBody,
  color: t.ink, background: t.surface, outline: 'none',
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isMobile = useIsMobile()

  const [params, setParams] = useState({
    page: 1, limit: 20, sort_by: 'fetched_at', order: 'desc',
    platform: '', status: '', score_min: '', score_max: '', title: '',
    experience_level: '',
  })
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [showDeleteAll, setShowDeleteAll] = useState(false)
  const [taskId, setTaskId] = useState(null)
  const [scoringTaskId, setScoringTaskId] = useState(null)
  const [hoveredRow, setHoveredRow] = useState(null)

  function setParam(key, value) {
    setParams(p => ({ ...p, [key]: value, page: 1 }))
  }

  const queryParams = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== '' && v !== null)
  )

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['jobs', queryParams],
    queryFn: () => jobsApi.list(queryParams).then(r => r.data),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => jobsApi.delete(id),
    onSuccess: () => {
      toast.success('Job deleted')
      queryClient.invalidateQueries(['jobs'])
      setDeleteTarget(null)
    },
    onError: () => toast.error('Delete failed'),
  })

  const deleteAllMutation = useMutation({
    mutationFn: () => jobsApi.deleteAll(),
    onSuccess: () => {
      toast.success('All jobs deleted')
      queryClient.invalidateQueries(['jobs'])
      setShowDeleteAll(false)
    },
    onError: () => toast.error('Delete failed'),
  })

  const triggerMutation = useMutation({
    mutationFn: () => jobsApi.trigger(),
    onSuccess: (res) => {
      setTaskId(res.data.task_id)
      toast.success('Pipeline triggered — fetching jobs…')
    },
    onError: () => toast.error('Trigger failed'),
  })

  // Poll pipeline task until done, then hand off to scoring task
  const { data: pipelineStatus } = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => jobsApi.taskStatus(taskId).then(r => r.data),
    enabled: !!taskId,
    refetchInterval: (query) => {
      const s = query.state.data?.status
      return (s === 'SUCCESS' || s === 'FAILURE') ? false : 2000
    },
  })

  // Poll scoring task until done, then refresh jobs
  const { data: scoringStatus } = useQuery({
    queryKey: ['task', scoringTaskId],
    queryFn: () => jobsApi.taskStatus(scoringTaskId).then(r => r.data),
    enabled: !!scoringTaskId,
    refetchInterval: (query) => {
      const s = query.state.data?.status
      return (s === 'SUCCESS' || s === 'FAILURE') ? false : 2000
    },
  })

  useEffect(() => {
    if (!pipelineStatus) return
    if (pipelineStatus.status === 'SUCCESS') {
      setTaskId(null)
      const sid = pipelineStatus.result?.scoring_task_id
      if (sid) {
        setScoringTaskId(sid)
      } else {
        queryClient.invalidateQueries({ queryKey: ['jobs'] })
        toast.success('Jobs synced')
      }
    } else if (pipelineStatus.status === 'FAILURE') {
      setTaskId(null)
      toast.error('Pipeline failed')
    }
  }, [pipelineStatus?.status])

  useEffect(() => {
    if (!scoringStatus) return
    if (scoringStatus.status === 'SUCCESS') {
      setScoringTaskId(null)
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      const scored = scoringStatus.result?.scored ?? 0
      toast.success(scored > 0 ? `Synced and scored ${scored} jobs` : 'Jobs synced')
    } else if (scoringStatus.status === 'FAILURE') {
      setScoringTaskId(null)
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      toast.error('Scoring failed')
    }
  }, [scoringStatus?.status])

  const jobs = data?.items || []
  const total = data?.total || 0
  const totalPages = data?.total_pages || 1

  const hasFilters = params.platform || params.status || params.score_min || params.score_max || params.title || params.experience_level

  function clearFilters() {
    setParams(p => ({ ...p, platform: '', status: '', score_min: '', score_max: '', title: '', experience_level: '', page: 1 }))
  }

  function getPageNums() {
    let start = Math.max(1, params.page - 2)
    const end = Math.min(totalPages, start + 4)
    if (end - start < 4) start = Math.max(1, end - 4)
    const pages = []
    for (let i = start; i <= end; i++) pages.push(i)
    return pages
  }

  return (
    <div style={{ padding: '2rem 1.5rem', minHeight: '100vh', background: t.bg }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: t.ink, fontFamily: t.fontDisplay, margin: 0 }}>
            {total} jobs found
          </h1>
          <p style={{ fontSize: 13, color: t.inkLight, fontFamily: t.fontBody, marginTop: 4, marginBottom: 0 }}>
            {total > 0 ? `${total} jobs matched your profile` : 'Run the pipeline to fetch jobs'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
          {/* Sync now */}
          <button
            style={{
              border: `1px solid ${t.border}`, borderRadius: 8, padding: '8px 18px',
              background: t.surface, color: t.ink, fontSize: 13, fontWeight: 500,
              fontFamily: t.fontBody, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              opacity: triggerMutation.isPending ? 0.6 : 1,
            }}
            onClick={() => triggerMutation.mutate()}
            disabled={triggerMutation.isPending}
          >
            {triggerMutation.isPending ? <Spinner size="sm" /> : <Play style={{ width: 14, height: 14 }} />}
            Sync now
          </button>

          {/* Delete All */}
          <button
            style={{
              border: `1px solid ${t.red}`, borderRadius: 8, padding: '8px 18px',
              background: 'transparent', color: t.red, fontSize: 13, fontWeight: 500,
              fontFamily: t.fontBody, cursor: total === 0 ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              opacity: total === 0 ? 0.4 : 1,
            }}
            onClick={() => setShowDeleteAll(true)}
            disabled={total === 0}
          >
            <Eraser style={{ width: 14, height: 14 }} />
            Delete All
          </button>

          {/* + Filters */}
          <button
            style={{
              border: 'none', borderRadius: 8, padding: '8px 18px',
              background: t.violet, color: '#fff', fontSize: 13, fontWeight: 600,
              fontFamily: t.fontBody, cursor: 'pointer',
            }}
            onClick={() => navigate('/filters')}
          >
            + Filters
          </button>
        </div>
      </div>

      {/* ── Pipeline / scoring progress banner ────────────────────────── */}
      {(taskId || scoringTaskId) && (
        <div style={{
          background: scoringTaskId ? '#EFF6FF' : '#ECFDF5',
          border: `1px solid ${scoringTaskId ? '#93C5FD' : '#6EE7B7'}`,
          color: scoringTaskId ? '#1D4ED8' : '#059669',
          borderRadius: 8, padding: '10px 16px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 13, fontFamily: t.fontBody,
        }}>
          <Spinner size="sm" />
          <span>
            {scoringTaskId
              ? 'Scoring jobs against your CV…'
              : 'Fetching jobs from all platforms…'}
          </span>
          <button
            style={{
              marginLeft: 'auto', background: 'none', border: 'none',
              cursor: 'pointer', color: 'inherit', display: 'flex', padding: 0,
            }}
            onClick={() => { setTaskId(null); setScoringTaskId(null) }}
          >
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>
      )}

      {/* ── Filter bar ─────────────────────────────────────────────────── */}
      <div style={{
        background: t.surface, border: `1px solid ${t.border}`,
        borderRadius: 12, marginBottom: 16, overflow: 'hidden',
      }}>
        {/* Row 1 — status tabs + showing count */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderBottom: `1px solid ${t.border}`, gap: 8,
        }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: isMobile ? 'nowrap' : 'wrap', overflowX: isMobile ? 'auto' : 'visible', WebkitOverflowScrolling: 'touch' }}>
            {STATUS_TABS.map(tab => {
              const active = params.status === tab.value
              return (
                <button
                  key={tab.value}
                  onClick={() => setParam('status', tab.value)}
                  style={active ? {
                    background: t.violet, color: '#fff', borderRadius: 7,
                    padding: '6px 14px', border: 'none', fontFamily: t.fontBody,
                    fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  } : {
                    background: 'transparent', border: `1px solid ${t.border}`,
                    color: t.inkMid, borderRadius: 7, padding: '6px 14px',
                    fontFamily: t.fontBody, fontSize: 13, fontWeight: 400, cursor: 'pointer',
                  }}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
          <span style={{ fontSize: 13, color: t.inkLight, fontFamily: t.fontBody, whiteSpace: 'nowrap', flexShrink: 0 }}>
            Showing {jobs.length} of {total}
          </span>
        </div>

        {/* Row 2 — search + scope + platform + score + sort */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', flexWrap: 'wrap' }}>
          {/* Search */}
          <input
            style={{ ...inputStyle, flex: isMobile ? '1 1 100%' : '1 1 180px' }}
            placeholder="Search jobs or keywords…"
            value={params.title}
            onChange={e => setParam('title', e.target.value)}
          />

          {/* Scope (experience level) */}
          <select
            style={{ ...inputStyle, cursor: 'pointer', minWidth: 120 }}
            value={params.experience_level}
            onChange={e => setParam('experience_level', e.target.value)}
          >
            <option value="">All levels</option>
            <option value="junior">Junior</option>
            <option value="mid">Mid</option>
            <option value="senior">Senior</option>
          </select>

          {/* Platform */}
          <select
            style={{ ...inputStyle, cursor: 'pointer', minWidth: 140 }}
            value={params.platform}
            onChange={e => setParam('platform', e.target.value)}
          >
            <option value="">All platforms</option>
            <option value="weworkremotely">We Work Remotely</option>
            <option value="himalayas">Himalayas</option>
            <option value="arcdev">Arc.dev</option>
            <option value="remoteok">RemoteOK</option>
            <option value="workingnomads">Working Nomads</option>
            <option value="empllo">Empllo</option>
            <option value="remotive">Remotive</option>
            <option value="arbeitnow">Arbeitnow</option>
            <option value="jobicy">Jobicy</option>
          </select>

          {/* Score range */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 12, color: t.inkMid, fontFamily: t.fontBody, whiteSpace: 'nowrap' }}>Score</span>
            <input
              style={{ ...inputStyle, width: 76 }}
              placeholder="Min"
              type="number" min="0" max="100"
              value={params.score_min}
              onChange={e => setParam('score_min', e.target.value)}
            />
            <span style={{ color: t.inkLight, fontSize: 12 }}>–</span>
            <input
              style={{ ...inputStyle, width: 76 }}
              placeholder="Max"
              type="number" min="0" max="100"
              value={params.score_max}
              onChange={e => setParam('score_max', e.target.value)}
            />
          </div>

          {/* Sort */}
          <select
            style={{ ...inputStyle, cursor: 'pointer', minWidth: 128 }}
            value={params.sort_by}
            onChange={e => setParam('sort_by', e.target.value)}
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* Order toggle */}
          <button
            style={{ ...inputStyle, cursor: 'pointer', padding: '7px 11px', background: '#F9F9F8', fontSize: 15 }}
            onClick={() => setParam('order', params.order === 'desc' ? 'asc' : 'desc')}
            title="Toggle order"
          >
            {params.order === 'desc' ? '↓' : '↑'}
          </button>

          {/* Clear */}
          {hasFilters && (
            <button
              style={{
                background: 'none', border: `1px solid ${t.border}`, borderRadius: 8,
                padding: '7px 12px', color: t.inkMid, cursor: 'pointer',
                fontSize: 13, fontFamily: t.fontBody,
                display: 'flex', alignItems: 'center', gap: 4,
              }}
              onClick={clearFilters}
            >
              <X style={{ width: 12, height: 12 }} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 64 }}>
            <Spinner />
          </div>
        ) : jobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 64, fontFamily: t.fontBody }}>
            <p style={{ fontSize: 15, fontWeight: 500, color: t.inkMid, marginBottom: 6 }}>No jobs found</p>
            <p style={{ fontSize: 13, color: t.inkLight, margin: 0 }}>
              Run the pipeline or adjust your filters to see matching jobs.
            </p>
          </div>
        ) : isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 12px 16px' }}>
            {jobs.map(job => (
              <MobileJobCard
                key={job.id}
                job={job}
                navigate={navigate}
                onDelete={(j) => setDeleteTarget(j)}
              />
            ))}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F9F9F8', borderBottom: `1px solid ${t.border}` }}>
                  {[
                    { label: 'ROLE',     minW: 220 },
                    { label: 'SCORE',    minW: 90 },
                    { label: 'STATUS',   minW: 100 },
                    { label: 'PLATFORM', minW: 140 },
                    { label: 'POSTED',   minW: 90 },
                    { label: '',         minW: 80 },
                  ].map(col => (
                    <th
                      key={col.label}
                      style={{
                        textAlign: 'left', padding: '10px 16px',
                        fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
                        color: t.inkLight, fontFamily: t.fontDisplay,
                        textTransform: 'uppercase', whiteSpace: 'nowrap',
                        minWidth: col.minW,
                      }}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.map(job => {
                  const sc = scoreColor(job.score)
                  const isHovered = hoveredRow === job.id
                  return (
                    <tr
                      key={job.id}
                      style={{
                        borderBottom: '1px solid #F0EFEB',
                        background: isHovered ? '#FAFAF8' : t.surface,
                        cursor: 'pointer',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={() => setHoveredRow(job.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                      onClick={() => navigate(`/jobs/${job.id}`)}
                    >
                      {/* ROLE */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: 8,
                            background: getAvatarBg(job.company), color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 700, fontSize: 15, flexShrink: 0,
                            fontFamily: t.fontDisplay,
                          }}>
                            {(job.company || '?')[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{
                              fontSize: 14, fontWeight: 600, color: t.ink,
                              fontFamily: t.fontBody, lineHeight: 1.3,
                            }}>
                              {job.title}
                            </div>
                            <div style={{ fontSize: 12, color: t.inkLight, fontFamily: t.fontBody, marginTop: 2 }}>
                              {job.company}{job.location ? ` · ${job.location}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* SCORE */}
                      <td style={{ padding: '12px 16px' }}>
                        {sc !== null ? (
                          <div>
                            <span style={{ fontSize: 18, fontWeight: 700, color: sc, fontFamily: t.fontDisplay }}>
                              {Math.round(job.score)}
                            </span>
                            <div style={{
                              marginTop: 4, height: 4, borderRadius: 2,
                              background: '#F0EFEB', width: 56, overflow: 'hidden',
                            }}>
                              <div style={{
                                height: '100%', borderRadius: 2,
                                background: sc, width: `${job.score}%`,
                              }} />
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: 16, color: t.inkLight, fontFamily: t.fontDisplay }}>—</span>
                        )}
                      </td>

                      {/* STATUS */}
                      <td style={{ padding: '12px 16px' }}>
                        <StatusPill status={job.status} />
                      </td>

                      {/* PLATFORM */}
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{
                            width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                            background: PLATFORM_DOT_COLORS[job.platform] || t.inkLight,
                          }} />
                          <span style={{ fontSize: 13, color: t.inkMid, fontFamily: t.fontBody }}>
                            {getPlatformLabel(job.platform)}
                          </span>
                        </div>
                      </td>

                      {/* POSTED */}
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: 12, color: t.inkLight, fontFamily: t.fontBody }}>
                          {formatDate(job.posted_at)}
                        </span>
                      </td>

                      {/* ACTIONS */}
                      <td style={{ padding: '12px 16px' }}>
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                          onClick={e => e.stopPropagation()}
                        >
                          <button
                            style={{
                              border: `1px solid ${t.violetLight}`, borderRadius: 6,
                              padding: '4px 10px', background: t.violetLight,
                              color: t.violet, fontSize: 12, fontWeight: 500,
                              fontFamily: t.fontBody, cursor: 'pointer',
                              display: 'flex', alignItems: 'center', gap: 4,
                            }}
                            onClick={() => navigate(`/jobs/${job.id}`)}
                          >
                            <Eye style={{ width: 12, height: 12 }} />
                            View
                          </button>
                          <TrashBtn onClick={() => setDeleteTarget(job)} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination ─────────────────────────────────────────────── */}
        {!isLoading && jobs.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderTop: `1px solid ${t.border}`,
          }}>
            {/* Left: page X of Y + rows per page */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13, color: t.inkLight, fontFamily: t.fontBody }}>
                Page {params.page} of {totalPages}
              </span>
              <select
                style={{
                  border: `1px solid ${t.border}`, borderRadius: 6,
                  padding: '4px 8px', fontSize: 12, fontFamily: t.fontBody,
                  color: t.inkMid, background: t.surface, cursor: 'pointer', outline: 'none',
                }}
                value={params.limit}
                onChange={e => setParams(p => ({ ...p, limit: Number(e.target.value), page: 1 }))}
              >
                {PAGE_SIZES.map(s => <option key={s} value={s}>{s} / page</option>)}
              </select>
            </div>

            {/* Right: prev + page numbers + next */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                style={{
                  border: `1px solid ${t.border}`, borderRadius: 6, background: t.surface,
                  padding: '5px 8px', cursor: 'pointer', color: t.inkMid,
                  display: 'flex', alignItems: 'center',
                  opacity: params.page <= 1 || isFetching ? 0.35 : 1,
                }}
                onClick={() => setParams(p => ({ ...p, page: p.page - 1 }))}
                disabled={params.page <= 1 || isFetching}
              >
                <ChevronLeft style={{ width: 15, height: 15 }} />
              </button>

              {getPageNums().map(n => (
                <button
                  key={n}
                  style={{
                    border: n === params.page ? 'none' : `1px solid ${t.border}`,
                    borderRadius: 6, padding: '5px 10px', fontSize: 13,
                    fontFamily: t.fontBody, cursor: 'pointer',
                    background: n === params.page ? t.violet : t.surface,
                    color: n === params.page ? '#fff' : t.inkMid,
                    fontWeight: n === params.page ? 600 : 400,
                    minWidth: 32, textAlign: 'center',
                  }}
                  onClick={() => setParams(p => ({ ...p, page: n }))}
                  disabled={isFetching}
                >
                  {n}
                </button>
              ))}

              <button
                style={{
                  border: `1px solid ${t.border}`, borderRadius: 6, background: t.surface,
                  padding: '5px 8px', cursor: 'pointer', color: t.inkMid,
                  display: 'flex', alignItems: 'center',
                  opacity: params.page >= totalPages || isFetching ? 0.35 : 1,
                }}
                onClick={() => setParams(p => ({ ...p, page: p.page + 1 }))}
                disabled={params.page >= totalPages || isFetching}
              >
                <ChevronRight style={{ width: 15, height: 15 }} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Delete single job confirm ───────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this job?"
        description={deleteTarget
          ? `"${deleteTarget.title}" at ${deleteTarget.company} will be permanently removed.`
          : ''}
        danger
        onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* ── Delete all jobs confirm ─────────────────────────────────────── */}
      <ConfirmDialog
        open={showDeleteAll}
        title="Delete all jobs?"
        description={`All ${total} jobs will be permanently removed. User data, CV, and filters are not affected.`}
        danger
        onConfirm={() => deleteAllMutation.mutate()}
        onCancel={() => setShowDeleteAll(false)}
      />
    </div>
  )
}

/** Mobile card view for a single job */
function MobileJobCard({ job, navigate, onDelete }) {
  const sc = scoreColor(job.score)
  const statusCfgMap = {
    new:        { bg: '#F4F4F5', color: '#52525B', border: '#E4E2DC', label: 'New' },
    interested: { bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE', label: 'Interested' },
    applied:    { bg: '#ECFDF5', color: '#059669', border: '#A7F3D0', label: 'Applied' },
    skipped:    { bg: '#F4F4F5', color: '#A1A1AA', border: '#E4E2DC', label: 'Skipped' },
  }
  const status = statusCfgMap[job.status] || statusCfgMap.new
  return (
    <div
      style={{
        background: '#FFFFFF', border: '1px solid #E4E2DC',
        borderRadius: 10, padding: 14, cursor: 'pointer',
      }}
      onClick={() => navigate(`/jobs/${job.id}`)}
    >
      {/* Top row: avatar + title + score */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8, flexShrink: 0,
          background: getAvatarBg(job.company), color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 15,
        }}>
          {(job.company || '?')[0].toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 600, color: '#18181B',
            fontFamily: '"Inter", system-ui, sans-serif',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {job.title}
          </div>
          <div style={{ fontSize: 12, color: '#A1A1AA', fontFamily: '"Inter", system-ui, sans-serif', marginTop: 2 }}>
            {job.company}{job.location ? ` · ${job.location.slice(0, 28)}` : ''}
          </div>
        </div>
        {job.score !== null && job.score !== undefined && (
          <div style={{
            fontSize: 17, fontWeight: 700,
            color: sc,
            fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
            flexShrink: 0, alignSelf: 'flex-start', marginTop: 2,
          }}>
            {Math.round(job.score)}
          </div>
        )}
      </div>
      {/* Bottom row: status + platform + posted + delete */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 11, fontWeight: 600, borderRadius: 5,
          padding: '2px 8px', flexShrink: 0,
          background: status.bg,
          color: status.color,
          border: `1px solid ${status.border}`,
        }}>
          {status.label}
        </span>
        {PLATFORM_DOT_COLORS[job.platform] && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#A1A1AA' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: PLATFORM_DOT_COLORS[job.platform] }} />
            {PLATFORM_CONFIG[job.platform]?.short || job.platform}
          </span>
        )}
        <span style={{ fontSize: 11, color: '#A1A1AA', flex: 1 }}>
          {formatDate(job.posted_at)}
        </span>
        <button
          onClick={e => { e.stopPropagation(); onDelete(job) }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#A1A1AA', padding: 2, display: 'flex', alignItems: 'center',
          }}
        >
          <Trash2 style={{ width: 14, height: 14 }} />
        </button>
      </div>
    </div>
  )
}

/** Trash icon button with hover-red effect (stateful hover via onMouse*) */
function TrashBtn({ onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: hovered ? '#DC2626' : '#A1A1AA',
        padding: 4, borderRadius: 6,
        display: 'flex', alignItems: 'center',
        transition: 'color 0.15s',
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title="Delete"
    >
      <Trash2 style={{ width: 14, height: 14 }} />
    </button>
  )
}
