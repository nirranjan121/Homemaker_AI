/**
 * AiVerifierPanel.jsx
 * Upload a floor plan image → Groq Llama Vision AI compares it to the JSON geometry
 * → Returns structured accuracy report with scores, issues list, and recommendations.
 */
import { useState, useRef, useCallback } from 'react'

const SEVERITY_STYLES = {
  high:   'bg-red-500/15 border-red-500/30 text-red-400',
  medium: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
  low:    'bg-blue-500/15 border-blue-500/30 text-blue-400',
}

const ScoreBar = ({ label, score, color }) => (
  <div className="space-y-1">
    <div className="flex justify-between items-center">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="text-xs font-bold" style={{ color }}>{score}/100</span>
    </div>
    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-1000"
        style={{ width: `${score}%`, background: color }}
      />
    </div>
  </div>
)

export default function AiVerifierPanel({ planJson }) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef()

  const handleFile = useCallback((f) => {
    if (!f || !f.type.startsWith('image/')) {
      setError('Please upload an image file.')
      return
    }
    setFile(f)
    setError(null)
    setResult(null)
    const reader = new FileReader()
    reader.onload = e => setPreview(e.target.result)
    reader.readAsDataURL(f)
  }, [])

  const runAiVerify = useCallback(async () => {
    if (!file) { setError('Upload a floor plan image first.'); return }
    if (!planJson) { setError('3D model not loaded yet.'); return }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const b64 = await new Promise((res, rej) => {
        const reader = new FileReader()
        reader.onload = e => res(e.target.result.split(',')[1])
        reader.onerror = rej
        reader.readAsDataURL(file)
      })

      const response = await fetch('http://localhost:8000/ai-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_b64: b64, plan_json: planJson }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.detail || 'AI verification failed')
      }

      setResult(await response.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [file, planJson])

  const score = result?.overall_match_score ?? 0
  const scoreColor = score >= 70 ? '#22d3a5' : score >= 45 ? '#f59e0b' : '#ef4444'

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: '#0a0a12' }}>

      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-white/5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-base">🤖</span>
          <h2 className="font-bold text-slate-100 text-sm">AI Plan Verifier</h2>
          <span className="hud-pill text-violet-400 text-[10px] border-violet-400/30">Llama 3.2 Vision</span>
        </div>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Upload your original 2D drawing. Groq's vision AI will compare it against the 3D JSON geometry and flag any discrepancies.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">

        {/* Upload */}
        <div
          className={`rounded-xl border-2 border-dashed p-3 text-center cursor-pointer transition-all
            ${dragOver ? 'border-violet-400 bg-violet-400/10' : 'border-white/10 hover:border-violet-400/40 hover:bg-violet-400/5'}`}
          onClick={() => !preview && fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
        >
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={e => handleFile(e.target.files[0])} />

          {preview ? (
            <div className="space-y-2">
              <img src={preview} alt="Floor plan" className="max-h-36 mx-auto rounded-lg object-contain" />
              <p className="text-[10px] text-slate-500">{file?.name}</p>
              <button className="text-[10px] text-slate-600 hover:text-red-400 transition-colors"
                onClick={e => { e.stopPropagation(); setPreview(null); setFile(null); setResult(null) }}>
                ✕ Remove
              </button>
            </div>
          ) : (
            <div className="py-5 space-y-2">
              <div className="text-2xl">🏗️</div>
              <p className="text-xs text-slate-400">Drop your floor plan drawing here</p>
              <p className="text-[10px] text-slate-600">JPG, PNG, PDF scan accepted</p>
            </div>
          )}
        </div>

        {/* Run */}
        <button
          onClick={runAiVerify}
          disabled={loading || !file}
          className={`w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all
            ${file && !loading
              ? 'text-white shadow-lg hover:-translate-y-0.5'
              : 'bg-white/5 text-slate-600 cursor-not-allowed'}`}
          style={file && !loading ? { background: 'linear-gradient(135deg, #7c6fff, #22d3a5)', boxShadow: '0 0 20px rgba(124,111,255,0.3)' } : {}}
        >
          {loading
            ? <><span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />Analysing with AI...</>
            : <>🤖 Run AI Verification</>}
        </button>

        {error && (
          <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            ⚠ {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-3 animate-fade-in">

            {/* Overall score */}
            <div className="rounded-xl p-4 border border-white/5" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-slate-400 font-medium">Overall Match Score</span>
                <div className="text-3xl font-bold" style={{ color: scoreColor }}>{score}<span className="text-sm text-slate-500">/100</span></div>
              </div>

              <div className="space-y-2 mb-3">
                <ScoreBar label="Wall Accuracy" score={result.wall_accuracy_score ?? 0} color="#7c6fff" />
                <ScoreBar label="Door Accuracy" score={result.door_accuracy_score ?? 0} color="#22d3a5" />
              </div>

              {/* Room count */}
              <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border
                ${result.room_count_match
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                <span>{result.room_count_match ? '✅' : '❌'}</span>
                <span>Room count {result.room_count_match ? 'matches' : 'does NOT match'} the drawing</span>
              </div>
            </div>

            {/* Verdict banner */}
            <div className={`px-3 py-2 rounded-lg text-xs font-medium border text-center
              ${score >= 70
                ? 'bg-emerald-500/15 border-emerald-500/20 text-emerald-400'
                : score >= 45
                ? 'bg-amber-500/15 border-amber-500/20 text-amber-400'
                : 'bg-red-500/15 border-red-500/20 text-red-400'}`}>
              {score >= 70 ? '✅ High accuracy' : score >= 45 ? '⚠️ Moderate accuracy' : '❌ Significant discrepancies'}
            </div>

            {/* Issues */}
            {result.issues?.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Issues Found</p>
                {result.issues.map((issue, i) => (
                  <div key={i} className={`px-3 py-2 rounded-lg border text-[11px] ${SEVERITY_STYLES[issue.severity] || SEVERITY_STYLES.low}`}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-semibold uppercase text-[9px] tracking-wider opacity-70">{issue.severity}</span>
                      {issue.location && <span className="opacity-60 text-[9px]">{issue.location}</span>}
                    </div>
                    <p>{issue.description}</p>
                  </div>
                ))}
              </div>
            )}

            {/* What matched */}
            {result.matches?.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">What Matched</p>
                {result.matches.map((m, i) => (
                  <div key={i} className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400">
                    <span className="font-semibold">{m.element}: </span>{m.description}
                  </div>
                ))}
              </div>
            )}

            {/* Summary */}
            {result.summary && (
              <div className="rounded-xl p-3 border border-white/5 text-[11px] text-slate-400 leading-relaxed"
                style={{ background: 'rgba(255,255,255,0.02)' }}>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1.5">AI Summary</p>
                <p>{result.summary}</p>
              </div>
            )}

            {/* Recommendation */}
            {result.recommendation && (
              <div className="rounded-xl p-3 bg-violet-500/10 border border-violet-500/20 text-[11px] text-violet-300 leading-relaxed">
                <p className="text-[10px] uppercase tracking-wider font-semibold mb-1.5">💡 Recommendation</p>
                <p>{result.recommendation}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
