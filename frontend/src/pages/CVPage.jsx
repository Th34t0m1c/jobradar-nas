import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cvApi } from '../api/client'
import { Spinner } from '../components/ui'
import { formatDateFull } from '../utils/helpers'
import { FileText, CheckCircle, Copy, Check, AlertTriangle, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

const t = {
  violet:      '#7C3AED',
  violetLight: '#EDE9FE',
  bg:          '#F5F4F0',
  surface:     '#FFFFFF',
  border:      '#E4E2DC',
  ink:         '#18181B',
  inkMid:      '#52525B',
  inkLight:    '#A1A1AA',
  red:         '#DC2626',
  redLight:    '#FEF2F2',
  amber:       '#D97706',
  amberLight:  '#FFFBEB',
  green:       '#059669',
  greenLight:  '#ECFDF5',
  fontDisplay: '"Plus Jakarta Sans", system-ui, sans-serif',
  fontBody:    '"Inter", system-ui, sans-serif',
}

const sectionLabel = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: t.inkLight,
  fontFamily: t.fontDisplay,
  marginBottom: 10,
}

function buildAIPrompt(extractedText) {
  return `Analyze the following CV and write a professional summary for job-matching purposes.

Requirements:
- Length: 1500–2500 characters
- Plain text only (no markdown, no bullet points, no headers)
- Third person
- Cover: target job title and seniority level, total years of experience, every technical skill mentioned (programming languages, frameworks, databases, cloud platforms, DevOps tools, APIs, methodologies), key responsibilities across each role, industry domains, notable achievements, and any location or remote-work preferences stated
- Be exhaustive with technical terms — this text is matched against job descriptions keyword-by-keyword

Return ONLY the summary text. No intro phrase like "Here is the summary:", just the summary itself.

===== CV =====
${extractedText}
==============`
}

function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      onClick={handleCopy}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '7px 14px',
        background: copied ? t.greenLight : t.surface,
        border: `1.5px solid ${copied ? t.green : t.border}`,
        borderRadius: 7,
        fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 13,
        color: copied ? t.green : t.ink,
        cursor: 'pointer', transition: 'all 0.15s',
      }}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? 'Copied!' : label}
    </button>
  )
}

export default function CVPage() {
  const queryClient = useQueryClient()
  const fileRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [summaryDraft, setSummaryDraft] = useState('')
  const [editingId, setEditingId] = useState(null)

  const { data: versions = [], isLoading } = useQuery({
    queryKey: ['cv'],
    queryFn: () => cvApi.list().then(r => r.data),
  })

  const uploadMutation = useMutation({
    mutationFn: (file) => cvApi.upload(file),
    onSuccess: (res) => {
      queryClient.invalidateQueries(['cv'])
      toast.success('CV uploaded — now paste the AI summary below')
      setSummaryDraft('')
      setEditingId(res.data.id)
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Upload failed'),
  })

  const saveSummaryMutation = useMutation({
    mutationFn: ({ id, summary }) => cvApi.setSummary(id, summary),
    onSuccess: () => {
      queryClient.invalidateQueries(['cv'])
      toast.success('Summary saved — job matching is now enabled')
      setSummaryDraft('')
      setEditingId(null)
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Save failed'),
  })

  const activateMutation = useMutation({
    mutationFn: (id) => cvApi.activate(id),
    onSuccess: () => {
      toast.success('CV version activated')
      queryClient.invalidateQueries(['cv'])
    },
    onError: () => toast.error('Activation failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => cvApi.delete(id),
    onSuccess: () => {
      toast.success('CV version deleted')
      queryClient.invalidateQueries(['cv'])
    },
    onError: (err) => {
      const detail = err.response?.data?.detail
      const status = err.response?.status
      toast.error(detail || (status ? `Delete failed (${status})` : err.message || 'Delete failed'))
    },
  })

  function handleFile(file) {
    if (!file) return
    if (!file.name.endsWith('.pdf')) {
      toast.error('Only PDF files are accepted')
      return
    }
    uploadMutation.mutate(file)
  }

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  const activeCV = versions.find(v => v.is_active)
  const historyVersions = versions.filter(v => !v.is_active)
  const hasSummary = !!activeCV?.summary?.trim()

  function startEditing(cv) {
    setEditingId(cv.id)
    setSummaryDraft(cv.summary || '')
  }

  return (
    <div style={{ padding: '2rem 1.5rem', minHeight: '100vh', background: t.bg, fontFamily: t.fontBody, maxWidth: 720, margin: '0 auto' }}>

      {/* ── Header ──────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: t.fontDisplay, fontWeight: 800, fontSize: 26, color: t.ink, marginBottom: 4 }}>
          CV Manager
        </h1>
        <p style={{ fontSize: 14, color: t.inkMid }}>
          Upload your CV, generate an AI summary, and enable job matching.
        </p>
      </div>

      {/* ── Upload zone ─────────────────────────────────────────── */}
      <div
        style={{
          background: dragging ? t.violetLight : t.surface,
          border: `2px dashed ${dragging ? t.violet : t.border}`,
          borderRadius: 12,
          padding: '36px 24px',
          textAlign: 'center',
          cursor: 'pointer',
          marginBottom: 28,
          transition: 'border-color 0.15s, background 0.15s',
        }}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf"
          style={{ display: 'none' }}
          onChange={e => handleFile(e.target.files[0])}
        />
        {uploadMutation.isPending ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <Spinner size="lg" />
            <p style={{ fontSize: 14, fontWeight: 600, color: t.ink, fontFamily: t.fontDisplay }}>
              Uploading and extracting text…
            </p>
          </div>
        ) : (
          <>
            <div style={{ width: 40, height: 48, margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="36" height="44" viewBox="0 0 40 48" fill="none">
                <rect x="1" y="1" width="38" height="46" rx="5" fill="white" stroke={t.border} strokeWidth="1.5"/>
                <rect x="8" y="14" width="24" height="2.5" rx="1.25" fill={t.border}/>
                <rect x="8" y="21" width="24" height="2.5" rx="1.25" fill={t.border}/>
                <rect x="8" y="28" width="16" height="2.5" rx="1.25" fill={t.border}/>
                <rect x="24" y="1" width="15" height="13" rx="0" fill={t.bg}/>
                <path d="M24 1 L39 14 L24 14 Z" fill={t.border}/>
              </svg>
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: t.ink, fontFamily: t.fontDisplay, marginBottom: 4 }}>
              Drag & drop your CV here
            </p>
            <p style={{ fontSize: 13, color: t.inkLight, marginBottom: 14 }}>
              PDF only · max 10 MB
            </p>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); fileRef.current?.click() }}
              style={{
                background: 'transparent',
                border: `1.5px solid ${t.border}`,
                borderRadius: 7, padding: '8px 20px',
                fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 13,
                color: t.ink, cursor: 'pointer',
              }}
            >
              Browse files
            </button>
          </>
        )}
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
          <Spinner size="lg" />
        </div>
      ) : versions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: t.inkLight, fontSize: 14 }}>
          No CV uploaded yet. Upload a PDF to get started.
        </div>
      ) : (
        <>
          {/* ── Active CV ────────────────────────────────────────── */}
          {activeCV && (
            <div style={{ marginBottom: 28 }}>
              <p style={sectionLabel}>Active CV</p>

              {/* File row */}
              <div style={{
                background: t.surface,
                border: `2px solid ${t.violet}`,
                borderRadius: 10,
                padding: '14px 20px',
                display: 'flex', alignItems: 'center', gap: 16,
                marginBottom: 12,
              }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: t.violetLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FileText size={18} color={t.violet} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: t.ink, fontFamily: t.fontDisplay, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {activeCV.filename}
                  </p>
                  <p style={{ fontSize: 12, color: t.inkLight }}>
                    Uploaded {formatDateFull(activeCV.uploaded_at)}
                  </p>
                </div>
                <span style={{ fontSize: 12, color: t.violet, fontWeight: 600, fontFamily: t.fontDisplay, display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                  <CheckCircle size={13} /> Active
                </span>
              </div>

              {/* Status banner */}
              {!hasSummary && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  background: t.amberLight, border: `1px solid ${t.amber}30`,
                  borderRadius: 8, padding: '10px 14px', marginBottom: 12,
                }}>
                  <AlertTriangle size={15} color={t.amber} style={{ flexShrink: 0, marginTop: 1 }} />
                  <p style={{ fontSize: 13, color: t.amber, fontFamily: t.fontBody, lineHeight: 1.5 }}>
                    <strong>Job matching is disabled.</strong> Follow the steps below to generate and save an AI summary.
                  </p>
                </div>
              )}

              {/* Step 1 — AI Prompt */}
              <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, padding: '16px 18px', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 12 }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: t.ink, fontFamily: t.fontDisplay }}>
                      Step 1 — Copy this prompt
                    </p>
                    <p style={{ fontSize: 12, color: t.inkMid, marginTop: 2 }}>
                      Paste it into Claude, ChatGPT, or any AI assistant to generate your summary.
                    </p>
                  </div>
                  {activeCV.extracted_text && (
                    <CopyButton text={buildAIPrompt(activeCV.extracted_text)} label="Copy Prompt" />
                  )}
                </div>

                {activeCV.extracted_text ? (
                  <pre style={{
                    background: '#F8F7F5',
                    border: `1px solid ${t.border}`,
                    borderRadius: 7,
                    padding: '10px 13px',
                    fontSize: 11.5,
                    color: t.inkMid,
                    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                    lineHeight: 1.6,
                    maxHeight: 160,
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    margin: 0,
                  }}>
                    {buildAIPrompt(activeCV.extracted_text)}
                  </pre>
                ) : (
                  <p style={{ fontSize: 12, color: t.inkLight, fontStyle: 'italic' }}>
                    Re-upload your CV to generate the prompt.
                  </p>
                )}
              </div>

              {/* Step 2 — Paste summary */}
              <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, padding: '16px 18px' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: t.ink, fontFamily: t.fontDisplay, marginBottom: 4 }}>
                  Step 2 — Paste the AI summary here
                </p>
                <p style={{ fontSize: 12, color: t.inkMid, marginBottom: 12 }}>
                  Paste the text the AI returned. This will be used for all job matching.
                </p>

                {editingId === activeCV.id || !hasSummary ? (
                  <>
                    <textarea
                      value={summaryDraft}
                      onChange={e => setSummaryDraft(e.target.value)}
                      placeholder="Paste the AI-generated summary here…"
                      rows={8}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        border: `1.5px solid ${t.border}`,
                        borderRadius: 8,
                        padding: '10px 13px',
                        fontSize: 13,
                        fontFamily: t.fontBody,
                        color: t.ink,
                        background: '#FAFAF9',
                        resize: 'vertical',
                        outline: 'none',
                        lineHeight: 1.6,
                      }}
                      onFocus={e => { e.target.style.borderColor = t.violet }}
                      onBlur={e => { e.target.style.borderColor = t.border }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                      <button
                        onClick={() => saveSummaryMutation.mutate({ id: activeCV.id, summary: summaryDraft })}
                        disabled={!summaryDraft.trim() || saveSummaryMutation.isPending}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 7,
                          background: !summaryDraft.trim() ? '#F4F4F5' : t.violet,
                          color: !summaryDraft.trim() ? t.inkLight : '#fff',
                          border: 'none', borderRadius: 8,
                          padding: '9px 20px',
                          fontFamily: t.fontDisplay, fontWeight: 700, fontSize: 13,
                          cursor: !summaryDraft.trim() ? 'not-allowed' : 'pointer',
                          transition: 'background 0.15s',
                        }}
                      >
                        {saveSummaryMutation.isPending && <Spinner size="sm" />}
                        Save Summary
                      </button>
                      {hasSummary && (
                        <button
                          onClick={() => { setEditingId(null); setSummaryDraft('') }}
                          style={{ background: 'transparent', border: 'none', fontSize: 13, color: t.inkLight, cursor: 'pointer', fontFamily: t.fontBody }}
                        >
                          Cancel
                        </button>
                      )}
                      {summaryDraft.trim() && (
                        <span style={{ fontSize: 12, color: t.inkLight, marginLeft: 'auto' }}>
                          {summaryDraft.trim().length.toLocaleString()} characters
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  /* Show saved summary with edit button */
                  <div>
                    <div style={{
                      background: '#FAFAF9',
                      border: `1px solid ${t.border}`,
                      borderRadius: 8, padding: '10px 13px',
                      marginBottom: 10,
                    }}>
                      <p style={{
                        fontSize: 12.5, color: t.inkMid, lineHeight: 1.7,
                        display: '-webkit-box', WebkitLineClamp: 6, WebkitBoxOrient: 'vertical',
                        overflow: 'hidden', whiteSpace: 'pre-wrap', margin: 0,
                      }}>
                        {activeCV.summary}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: t.green, fontWeight: 600 }}>
                        <CheckCircle size={13} /> Summary saved · job matching enabled
                      </span>
                      <button
                        onClick={() => startEditing(activeCV)}
                        style={{ marginLeft: 'auto', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 6, padding: '5px 12px', fontSize: 12, color: t.inkMid, cursor: 'pointer', fontFamily: t.fontBody }}
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Version History ─────────────────────────────────── */}
          {historyVersions.length > 0 && (
            <div>
              <p style={sectionLabel}>Version History</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {historyVersions.map(v => (
                  <div key={v.id} style={{
                    background: t.surface,
                    border: `1px solid ${t.border}`,
                    borderRadius: 10, padding: '14px 20px',
                    display: 'flex', alignItems: 'center', gap: 16,
                  }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: '#F4F4F5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FileText size={18} color={t.inkLight} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: t.ink, fontFamily: t.fontDisplay, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {v.filename}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <p style={{ fontSize: 12, color: t.inkLight }}>
                          Uploaded {formatDateFull(v.uploaded_at)}
                        </p>
                        {v.summary?.trim() && (
                          <span style={{ fontSize: 11, color: t.green, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                            <CheckCircle size={11} /> Summary
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <button
                        onClick={() => activateMutation.mutate(v.id)}
                        disabled={activateMutation.isPending || deleteMutation.isPending}
                        style={{
                          background: 'transparent', border: `1.5px solid ${t.border}`,
                          borderRadius: 7, padding: '6px 14px',
                          fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 13, color: t.ink,
                          cursor: (activateMutation.isPending || deleteMutation.isPending) ? 'not-allowed' : 'pointer',
                          opacity: (activateMutation.isPending || deleteMutation.isPending) ? 0.5 : 1,
                        }}
                      >
                        Set active
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(v.id)}
                        disabled={deleteMutation.isPending}
                        style={{
                          background: 'transparent', border: 'none', padding: '6px 4px',
                          color: t.red, cursor: deleteMutation.isPending ? 'not-allowed' : 'pointer',
                          opacity: deleteMutation.isPending ? 0.5 : 1, display: 'flex', alignItems: 'center',
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
