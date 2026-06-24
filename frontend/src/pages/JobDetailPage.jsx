import { useState, useMemo } from 'react'
import DOMPurify from 'dompurify'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { jobsApi, cvApi } from '../api/client'
import { ConfirmDialog, Spinner } from '../components/ui'
import { formatDateFull, getPlatformLabel, getAvatarBg } from '../utils/helpers'
import {
  ArrowLeft, ExternalLink, Trash2, Zap, Copy, Bot, FileText, PenLine
} from 'lucide-react'
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

const STATUSES = ['new', 'interested', 'applied', 'skipped']
const JOB_DESC_CHAR_LIMIT = 3000

function buildCoverLetterPrompt(job, cvSummary) {
  const descRaw = typeof job.description_json === 'object'
    ? JSON.stringify(job.description_json)
    : (job.description_json || '')
  const jobData = {
    title: job.title,
    company: job.company,
    location: job.location,
    job_type: job.job_type,
    tech_stack: job.tech_stack,
    description: descRaw.slice(0, JOB_DESC_CHAR_LIMIT),
  }
  const cvText = cvSummary || '[No active CV — upload your CV first]'
  return `You are an expert career coach. Write a tailored cover letter for the job below, based on the candidate's CV.

## Candidate CV Summary
${cvText}

## Job
${JSON.stringify(jobData, null, 2)}

## Instructions
- 3–4 paragraphs, 250–350 words
- Opening: genuine interest in the specific role and company
- Middle: connect 2–3 CV experiences directly to the job's requirements using their language
- Closing: confident call to action with availability
- Mirror the keywords and tone used in the job description
- Do NOT use placeholders like [Your Name] — write it as a complete, ready-to-send letter

Return ONLY the cover letter text. No explanation, no JSON, no markdown headers.`
}

function buildCvTailoringPrompt(job, cvSummary) {
  const descRaw = typeof job.description_json === 'object'
    ? JSON.stringify(job.description_json)
    : (job.description_json || '')
  const jobData = {
    title: job.title,
    company: job.company,
    tech_stack: job.tech_stack,
    description: descRaw.slice(0, JOB_DESC_CHAR_LIMIT),
  }
  const cvText = cvSummary || '[No active CV — upload your CV first]'
  return `You are an expert CV coach. Suggest targeted improvements to make this candidate's CV stronger for the specific job below.

## Candidate CV Summary
${cvText}

## Job
${JSON.stringify(jobData, null, 2)}

## Task
Return ONLY a valid JSON object with exactly these fields:
{
  "headline": "<revised one-line professional headline tailored to this role>",
  "summary": "<rewritten CV summary tailored to this role, 2–3 sentences>",
  "keywords": ["<ATS keyword to add 1>", "<keyword 2>", ...up to 8],
  "emphasize": ["<experience or project to move higher / expand on your CV>", ...up to 4],
  "additions": ["<concrete skill, certification, or project to add if you have it>", ...up to 4]
}

Be specific — reference actual skills and requirements from the job description.`
}

function buildScoringPrompt(job, cvSummary) {
  const descRaw = typeof job.description_json === 'object'
    ? JSON.stringify(job.description_json)
    : (job.description_json || '')
  const jobData = {
    title: job.title,
    company: job.company,
    location: job.location,
    job_type: job.job_type,
    experience_level: job.experience_level,
    tech_stack: job.tech_stack,
    description: descRaw.slice(0, JOB_DESC_CHAR_LIMIT),
  }
  const cvText = cvSummary || '[No active CV — upload your CV first]'
  return `You are an expert technical recruiter. Analyze how well a candidate matches a job and respond ONLY with valid JSON — no markdown, no explanation outside the JSON.

## Candidate CV Summary
${cvText}

## Job (JSON)
${JSON.stringify(jobData, null, 2)}

## Task
Return a JSON object with exactly these fields:
{
  "score": <integer 0-100>,
  "summary": "<2-3 sentence overall assessment>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "gaps": ["<gap 1>", "<gap 2>"],
  "suggestions": ["<suggestion 1>", "<suggestion 2>"]
}

Be specific — reference actual skills and requirements from the job.`
}

export default function JobDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [rawJson, setRawJson] = useState('')
  const [parseError, setParseError] = useState('')
  const [parsedResult, setParsedResult] = useState(null)
  const isMobile = useIsMobile()

  const { data: job, isLoading } = useQuery({
    queryKey: ['job', id],
    queryFn: () => jobsApi.get(id).then(r => r.data),
    staleTime: 30_000,
    retry: (count, err) => err?.response?.status !== 404 && count < 2,
  })

  const { data: activeCV } = useQuery({
    queryKey: ['cv', 'active'],
    queryFn: () => cvApi.getActive().then(r => r.data).catch(() => null),
    staleTime: 60_000,
  })

  const statusMutation = useMutation({
    mutationFn: (status) => jobsApi.updateStatus(id, status),
    onSuccess: (_, status) => {
      toast.success(`Status → ${status}`)
      queryClient.invalidateQueries(['job', id])
      queryClient.invalidateQueries(['jobs'])
    },
    onError: () => toast.error('Failed to update status'),
  })

  const matchMutation = useMutation({
    mutationFn: () => jobsApi.match(id),
    onSuccess: () => {
      toast.success('CV matched — score saved')
      queryClient.invalidateQueries(['job', id])
      queryClient.invalidateQueries(['jobs'])
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Matching failed'),
  })

  const scoreMutation = useMutation({
    mutationFn: (data) => jobsApi.saveScore(id, data),
    onSuccess: () => {
      toast.success('Score saved')
      queryClient.invalidateQueries(['job', id])
      queryClient.invalidateQueries(['jobs'])
      setRawJson('')
      setParsedResult(null)
      setParseError('')
    },
    onError: () => toast.error('Failed to save score'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => jobsApi.delete(id),
    onSuccess: () => {
      toast.success('Job deleted')
      queryClient.invalidateQueries(['jobs'])
      navigate('/dashboard')
    },
    onError: () => toast.error('Delete failed'),
  })

  const descriptionHtml = useMemo(() => {
    const raw = job?.description_json
    if (!raw) return null
    const text = typeof raw === 'string' ? raw : (raw.description || raw.summary || null)
    if (!text) return null
    return /<[a-z][\s\S]*>/i.test(text)
      ? DOMPurify.sanitize(text, {
          USE_PROFILES: { html: true },
          FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
          FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout', 'onfocus', 'onblur', 'onkeydown', 'onkeyup'],
          ALLOW_DATA_ATTR: false,
        })
      : text
  }, [job?.description_json])

  if (isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
      <Spinner />
    </div>
  )
  if (!job) return <div style={{ color: t.inkLight, fontSize: 14, fontFamily: t.fontBody }}>Job not found</div>

  const prompt = buildScoringPrompt(job, activeCV?.summary)
  const coverLetterPrompt = buildCoverLetterPrompt(job, activeCV?.summary)
  const cvTailoringPrompt = buildCvTailoringPrompt(job, activeCV?.summary)

  function copyPrompt() {
    navigator.clipboard.writeText(prompt)
    toast.success('Prompt copied — paste it into Claude.ai')
  }

  function copyCoverLetterPrompt() {
    navigator.clipboard.writeText(coverLetterPrompt)
    toast.success('Prompt copied — paste it into Claude.ai')
  }

  function copyCvTailoringPrompt() {
    navigator.clipboard.writeText(cvTailoringPrompt)
    toast.success('Prompt copied — paste it into Claude.ai')
  }


  function handleJsonChange(value) {
    setRawJson(value)
    setParseError('')
    setParsedResult(null)
    if (!value.trim()) return
    try {
      const parsed = JSON.parse(value.replace(/```json|```/g, '').trim())
      const missing = ['score', 'summary', 'strengths', 'gaps', 'suggestions'].filter(k => !(k in parsed))
      if (missing.length) { setParseError(`Missing fields: ${missing.join(', ')}`); return }
      parsed.score = Math.max(0, Math.min(100, parseInt(parsed.score)))
      setParsedResult(parsed)
    } catch {
      setParseError("Invalid JSON — copy Claude's full response without any extra text")
    }
  }

  function saveScore() {
    if (!parsedResult) return
    scoreMutation.mutate({
      score: parsedResult.score,
      analysis: {
        summary: parsedResult.summary,
        strengths: parsedResult.strengths,
        gaps: parsedResult.gaps,
        suggestions: parsedResult.suggestions,
      },
    })
  }

  let analysis = null
  try {
    analysis = typeof job.analysis === 'string' ? JSON.parse(job.analysis) : job.analysis
  } catch {}

  const techStack = job.tech_stack || []

  const scoreColor = job.score == null ? t.inkLight
    : job.score >= 80 ? '#059669'
    : job.score >= 60 ? '#D97706'
    : '#DC2626'

  const scoreLabel = job.score == null ? null
    : job.score >= 80 ? 'Strong match'
    : job.score >= 60 ? 'Good match'
    : 'Weak match'

  const companyInitial = (job.company || '?')[0].toUpperCase()

  return (
    <div style={{ padding: '2rem 1.5rem', minHeight: '100vh', background: t.bg }}>

      {/* Breadcrumb */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontFamily: t.fontBody }}>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', color: t.violet,
            fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
            padding: 0, fontFamily: t.fontBody, fontSize: 13,
          }}
        >
          <ArrowLeft style={{ width: 14, height: 14 }} />
          Dashboard
        </button>
        <span style={{ color: t.inkLight }}>/</span>
        <span style={{ color: t.inkMid }}>{job.company} — {job.title}</span>
      </div>

      {/* Two-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 300px', gap: 20, alignItems: 'start' }}>

        {/* ── LEFT COLUMN ── */}
        <div>

          {/* Job header card */}
          <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: 24, marginBottom: 16 }}>
            {/* Avatar + title */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: getAvatarBg(job.company), color: '#fff',
                fontWeight: 700, fontSize: 18, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: t.fontDisplay,
              }}>
                {companyInitial}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: t.ink, fontFamily: t.fontDisplay, lineHeight: 1.2 }}>
                  {job.title}
                </h1>
                <p style={{ margin: '4px 0 0', fontSize: 14, color: t.inkMid, fontFamily: t.fontBody }}>
                  {[job.company, job.location, job.job_type].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>

            {/* Tech stack tags */}
            {techStack.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {techStack.map(tech => (
                  <span
                    key={tech}
                    style={{
                      background: '#F4F4F5', border: '1px solid #E4E4E7',
                      borderRadius: 4, padding: '3px 8px', fontSize: 12,
                      color: t.inkMid, fontFamily: t.fontBody,
                    }}
                  >
                    {tech}
                  </span>
                ))}
              </div>
            )}

            {/* Action row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <a
                href={job.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  background: t.violet, color: '#fff', borderRadius: 8,
                  padding: '8px 18px', fontWeight: 600, fontSize: 14,
                  fontFamily: t.fontDisplay, textDecoration: 'none',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                <ExternalLink style={{ width: 14, height: 14 }} />
                Apply now
              </a>
              <select
                value={job.status || 'new'}
                onChange={e => statusMutation.mutate(e.target.value)}
                disabled={statusMutation.isPending}
                style={{
                  border: `1px solid ${t.border}`, borderRadius: 8,
                  padding: '8px 12px', fontSize: 14, fontFamily: t.fontBody,
                  color: t.ink, background: t.surface, cursor: 'pointer', outline: 'none',
                }}
              >
                {STATUSES.map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
              <button
                onClick={() => setConfirmDelete(true)}
                style={{
                  background: 'transparent', border: `1.5px solid ${t.red}`,
                  borderRadius: 8, padding: '7px 14px', fontSize: 14,
                  fontFamily: t.fontBody, color: t.red, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                <Trash2 style={{ width: 14, height: 14 }} />
                Delete job
              </button>
            </div>
          </div>

          {/* AI Match Analysis card */}
          {analysis && (
            <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: 24, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: t.ink, fontFamily: t.fontDisplay }}>
                  AI Match Analysis
                </h2>
                <span style={{ fontSize: 12, color: t.inkLight, fontFamily: t.fontBody }}>{activeCV ? activeCV.filename : ''}</span>
              </div>

              {analysis.summary && (
                <p style={{ margin: '0 0 16px', fontSize: 14, color: t.inkMid, fontFamily: t.fontBody, lineHeight: 1.6 }}>
                  {analysis.summary}
                </p>
              )}

              {analysis.strengths?.length > 0 && (
                <div style={{ background: '#F0FDF4', borderLeft: '3px solid #16A34A', borderRadius: 8, padding: 16, marginBottom: 12 }}>
                  <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#16A34A', fontFamily: t.fontDisplay }}>
                    Strengths
                  </p>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                    {analysis.strengths.map((s, i) => (
                      <li
                        key={i}
                        style={{
                          fontSize: 14, color: t.inkMid, fontFamily: t.fontBody,
                          lineHeight: 1.6, display: 'flex', gap: 8,
                          marginBottom: i < analysis.strengths.length - 1 ? 6 : 0,
                        }}
                      >
                        <span style={{ color: '#16A34A', flexShrink: 0 }}>•</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {analysis.gaps?.length > 0 && (
                <div style={{ background: '#FEF2F2', borderLeft: '3px solid #DC2626', borderRadius: 8, padding: 16, marginBottom: 12 }}>
                  <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#DC2626', fontFamily: t.fontDisplay }}>
                    Gaps
                  </p>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                    {analysis.gaps.map((g, i) => (
                      <li
                        key={i}
                        style={{
                          fontSize: 14, color: t.inkMid, fontFamily: t.fontBody,
                          lineHeight: 1.6, display: 'flex', gap: 8,
                          marginBottom: i < analysis.gaps.length - 1 ? 6 : 0,
                        }}
                      >
                        <span style={{ color: '#DC2626', flexShrink: 0 }}>•</span>
                        {g}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {analysis.suggestions?.length > 0 && (
                <div style={{ background: '#F5F3FF', borderLeft: '3px solid #7C3AED', borderRadius: 8, padding: 16 }}>
                  <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#7C3AED', fontFamily: t.fontDisplay }}>
                    Suggestions
                  </p>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                    {analysis.suggestions.map((s, i) => (
                      <li
                        key={i}
                        style={{
                          fontSize: 14, color: t.inkMid, fontFamily: t.fontBody,
                          lineHeight: 1.6, display: 'flex', gap: 8,
                          marginBottom: i < analysis.suggestions.length - 1 ? 6 : 0,
                        }}
                      >
                        <span style={{ color: '#7C3AED', flexShrink: 0 }}>•</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* CV Matching card */}
          <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: 24, marginBottom: 16 }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: t.ink, fontFamily: t.fontDisplay }}>
              Get a Match Score
            </h2>

            {!activeCV && (
              <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, padding: '10px 14px', color: '#92400E', fontSize: 13, fontFamily: t.fontBody, marginBottom: 16 }}>
                No active CV found — go to the CV page and upload your PDF first.
              </div>
            )}

            {/* Option A — instant keyword match */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 600, color: t.inkLight, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: t.fontDisplay }}>
                Option A — Instant (keyword matching)
              </p>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: t.inkMid, fontFamily: t.fontBody }}>
                Scores your CV against the job's tech stack and keywords locally. Fast but basic — no AI understanding.
              </p>
              <button
                onClick={() => matchMutation.mutate()}
                disabled={matchMutation.isPending || !activeCV}
                style={{
                  background: 'transparent', border: `1.5px solid ${t.border}`, borderRadius: 8,
                  padding: '8px 16px', cursor: matchMutation.isPending || !activeCV ? 'not-allowed' : 'pointer',
                  color: t.ink, fontFamily: t.fontBody, fontSize: 14,
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  opacity: matchMutation.isPending || !activeCV ? 0.4 : 1,
                }}
              >
                {matchMutation.isPending ? <Spinner size="sm" /> : <Zap style={{ width: 16, height: 16 }} />}
                {matchMutation.isPending ? 'Matching…' : 'Match with CV'}
              </button>
            </div>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
              <div style={{ flex: 1, height: 1, background: t.border }} />
              <span style={{ fontSize: 12, color: t.inkLight, fontFamily: t.fontBody }}>or</span>
              <div style={{ flex: 1, height: 1, background: t.border }} />
            </div>

            {/* Option B — Claude.ai */}
            <div>
              <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 600, color: t.violet, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: t.fontDisplay, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Bot style={{ width: 14, height: 14 }} /> Option B — Claude.ai (AI-powered, free)
              </p>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: t.inkMid, fontFamily: t.fontBody }}>
                Claude reads your full CV and the job description and gives a much more accurate score with detailed reasoning. Takes ~30 seconds.
              </p>

              {/* Step 1 */}
              <div style={{ marginBottom: 16 }}>
                <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: t.ink, fontFamily: t.fontDisplay }}>
                  Step 1 — Copy the prompt below
                </p>
                <div style={{ position: 'relative' }}>
                  <textarea
                    readOnly
                    value={prompt}
                    style={{
                      background: '#F9F9F8', border: `1px solid ${t.border}`, borderRadius: 8,
                      padding: 12, fontFamily: 'monospace', fontSize: 12, color: t.ink,
                      width: '100%', boxSizing: 'border-box', resize: 'vertical',
                      minHeight: 144, paddingRight: 72,
                    }}
                  />
                  <button
                    onClick={copyPrompt}
                    style={{
                      position: 'absolute', top: 8, right: 8,
                      background: 'transparent', border: `1px solid ${t.border}`,
                      borderRadius: 6, padding: '4px 10px', fontSize: 12,
                      color: t.inkMid, cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontFamily: t.fontBody,
                    }}
                  >
                    <Copy style={{ width: 12, height: 12 }} /> Copy
                  </button>
                </div>
              </div>

              {/* Step 2 */}
              <div style={{ marginBottom: 16 }}>
                <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: t.ink, fontFamily: t.fontDisplay }}>
                  Step 2 — Open Claude.ai and paste the prompt
                </p>
                <a
                  href="https://claude.ai"
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: t.violet, textDecoration: 'none', fontFamily: t.fontBody }}
                >
                  <ExternalLink style={{ width: 13, height: 13 }} /> Open Claude.ai
                </a>
                <p style={{ margin: '6px 0 0', fontSize: 13, color: t.inkMid, fontFamily: t.fontBody }}>
                  Paste the prompt, send it, and wait for Claude to reply with a JSON block.
                </p>
              </div>

              {/* Step 3 */}
              <div style={{ marginBottom: 16 }}>
                <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: t.ink, fontFamily: t.fontDisplay }}>
                  Step 3 — Paste Claude's JSON response here
                </p>
                <textarea
                  placeholder='{"score": 85, "summary": "...", "strengths": [...], "gaps": [...], "suggestions": [...]}'
                  value={rawJson}
                  onChange={e => handleJsonChange(e.target.value)}
                  style={{
                    background: '#F9F9F8', border: `1px solid ${t.border}`, borderRadius: 8,
                    padding: 12, fontFamily: 'monospace', fontSize: 12, color: t.ink,
                    width: '100%', boxSizing: 'border-box', resize: 'vertical', minHeight: 96,
                  }}
                />
                {parseError && (
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: t.red, fontFamily: t.fontBody }}>{parseError}</p>
                )}
                {parsedResult && (
                  <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 8, background: t.violetLight, border: `1px solid ${t.violet}30` }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: t.violet, fontFamily: 'monospace' }}>Score: {parsedResult.score}%</p>
                    {parsedResult.summary && (
                      <p style={{ margin: '4px 0 0', fontSize: 13, color: t.inkMid, fontFamily: t.fontBody, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {parsedResult.summary}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Step 4 — Save Score */}
              <button
                onClick={saveScore}
                disabled={!parsedResult || scoreMutation.isPending}
                style={{
                  background: t.violet, border: 'none', borderRadius: 8,
                  padding: '8px 20px', fontSize: 14, fontWeight: 600, color: '#fff',
                  cursor: !parsedResult || scoreMutation.isPending ? 'not-allowed' : 'pointer',
                  fontFamily: t.fontDisplay, display: 'inline-flex', alignItems: 'center', gap: 8,
                  opacity: !parsedResult || scoreMutation.isPending ? 0.5 : 1,
                }}
              >
                {scoreMutation.isPending && <Spinner size="sm" />}
                Save Score
              </button>
            </div>
          </div>

          {/* Cover Letter card */}
          <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: 24, marginBottom: 16 }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: t.ink, fontFamily: t.fontDisplay, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText style={{ width: 18, height: 18, color: t.violet }} />
              Generate Cover Letter
            </h2>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: t.inkMid, fontFamily: t.fontBody }}>
              Copy the prompt below, paste it into Claude.ai, and get a tailored cover letter in seconds.
            </p>

            {!activeCV && (
              <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, padding: '10px 14px', color: '#92400E', fontSize: 13, fontFamily: t.fontBody, marginBottom: 16 }}>
                No active CV found — upload your CV first.
              </div>
            )}

            <div style={{ position: 'relative', marginBottom: 16 }}>
              <textarea
                readOnly
                value={coverLetterPrompt}
                style={{
                  background: '#F9F9F8', border: `1px solid ${t.border}`, borderRadius: 8,
                  padding: 12, fontFamily: 'monospace', fontSize: 12, color: t.ink,
                  width: '100%', boxSizing: 'border-box', resize: 'vertical', minHeight: 120, paddingRight: 72,
                }}
              />
              <button
                onClick={copyCoverLetterPrompt}
                style={{
                  position: 'absolute', top: 8, right: 8,
                  background: 'transparent', border: `1px solid ${t.border}`,
                  borderRadius: 6, padding: '4px 10px', fontSize: 12,
                  color: t.inkMid, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontFamily: t.fontBody,
                }}
              >
                <Copy style={{ width: 12, height: 12 }} /> Copy
              </button>
            </div>

            <a
              href="https://claude.ai"
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: t.violet, color: '#fff', borderRadius: 8,
                padding: '8px 18px', fontSize: 14, fontWeight: 600,
                fontFamily: t.fontDisplay, textDecoration: 'none',
              }}
            >
              <ExternalLink style={{ width: 14, height: 14 }} /> Open Claude.ai
            </a>
          </div>

          {/* CV Tailoring card */}
          <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: 24, marginBottom: 16 }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: t.ink, fontFamily: t.fontDisplay, display: 'flex', alignItems: 'center', gap: 8 }}>
              <PenLine style={{ width: 18, height: 18, color: t.violet }} />
              Tailor Your CV
            </h2>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: t.inkMid, fontFamily: t.fontBody }}>
              Copy the prompt below, paste it into Claude.ai, and get a revised headline, rewritten summary, and ATS keywords tailored to this role.
            </p>

            {!activeCV && (
              <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, padding: '10px 14px', color: '#92400E', fontSize: 13, fontFamily: t.fontBody, marginBottom: 16 }}>
                No active CV found — upload your CV first.
              </div>
            )}

            <div style={{ position: 'relative', marginBottom: 16 }}>
              <textarea
                readOnly
                value={cvTailoringPrompt}
                style={{
                  background: '#F9F9F8', border: `1px solid ${t.border}`, borderRadius: 8,
                  padding: 12, fontFamily: 'monospace', fontSize: 12, color: t.ink,
                  width: '100%', boxSizing: 'border-box', resize: 'vertical', minHeight: 120, paddingRight: 72,
                }}
              />
              <button
                onClick={copyCvTailoringPrompt}
                style={{
                  position: 'absolute', top: 8, right: 8,
                  background: 'transparent', border: `1px solid ${t.border}`,
                  borderRadius: 6, padding: '4px 10px', fontSize: 12,
                  color: t.inkMid, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontFamily: t.fontBody,
                }}
              >
                <Copy style={{ width: 12, height: 12 }} /> Copy
              </button>
            </div>

            <a
              href="https://claude.ai"
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: t.violet, color: '#fff', borderRadius: 8,
                padding: '8px 18px', fontSize: 14, fontWeight: 600,
                fontFamily: t.fontDisplay, textDecoration: 'none',
              }}
            >
              <ExternalLink style={{ width: 14, height: 14 }} /> Open Claude.ai
            </a>
          </div>

          {/* About the role card */}
          {descriptionHtml && (
            <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: 24 }}>
              <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: t.ink, fontFamily: t.fontDisplay }}>
                About the role
              </h2>
              <div
                className="job-description"
                dangerouslySetInnerHTML={{ __html: descriptionHtml }}
              />
            </div>
          )}
        </div>

        {/* ── RIGHT SIDEBAR ── */}
        <div>

          {/* Match Score card */}
          <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: 24, marginBottom: 16 }}>
            <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 600, color: t.inkLight, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: t.fontDisplay }}>
              MATCH SCORE
            </p>
            {job.score != null ? (
              <>
                <div style={{ fontSize: 48, fontWeight: 700, color: scoreColor, lineHeight: 1, marginBottom: 12, fontFamily: t.fontDisplay }}>
                  {Math.round(job.score)}
                </div>
                <div style={{ height: 8, borderRadius: 4, background: '#E4E2DC', marginBottom: 8, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${job.score}%`, background: scoreColor, borderRadius: 4, transition: 'width 0.3s ease' }} />
                </div>
                <p style={{ margin: 0, fontSize: 12, color: t.inkMid, fontFamily: t.fontBody }}>
                  {scoreLabel}
                </p>
              </>
            ) : (
              <>
                <div style={{ fontSize: 48, fontWeight: 700, color: t.inkLight, lineHeight: 1, marginBottom: 12, fontFamily: t.fontDisplay }}>
                  —
                </div>
                <p style={{ margin: 0, fontSize: 13, color: t.inkMid, fontFamily: t.fontBody }}>No score yet</p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: t.inkMid, fontFamily: t.fontBody }}>Click Match with CV</p>
              </>
            )}
          </div>

          {/* Details card */}
          <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: 24, marginBottom: 16 }}>
            <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 600, color: t.inkLight, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: t.fontDisplay }}>
              DETAILS
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: t.inkLight, fontFamily: t.fontBody }}>Platform</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: t.ink, fontFamily: t.fontBody }}>{getPlatformLabel(job.platform)}</span>
              </div>
              {job.location && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: t.inkLight, fontFamily: t.fontBody }}>Location</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: t.ink, fontFamily: t.fontBody, textAlign: 'right', maxWidth: 160 }}>{job.location}</span>
                </div>
              )}
              {job.posted_at && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: t.inkLight, fontFamily: t.fontBody }}>Posted</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: t.ink, fontFamily: t.fontBody }}>{formatDateFull(job.posted_at)}</span>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this job?"
        description={`"${job.title}" will be permanently removed.`}
        danger
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
