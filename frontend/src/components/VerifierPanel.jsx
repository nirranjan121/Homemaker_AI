/**
 * VerifierPanel.jsx
 * Upload a floor plan image → capture 3D top-down screenshot → 
 * send both to backend /verify → display accuracy scores + visual comparisons.
 */
import { useState, useRef, useCallback, useEffect } from 'react'

const ScoreRing = ({ score, label, color }) => {
  const r = 28
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const scoreColor = score >= 70 ? '#22d3a5' : score >= 45 ? '#f59e0b' : '#ef4444'

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
        <circle
          cx="36" cy="36" r={r} fill="none"
          stroke={color || scoreColor} strokeWidth="7"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transform: 'rotate(-90deg)', transformOrigin: '36px 36px', transition: 'stroke-dashoffset 1s ease' }}
        />
        <text x="36" y="40" textAnchor="middle" fontSize="14" fontWeight="bold" fill="white">{score}</text>
      </svg>
      <span className="text-[10px] text-slate-500 text-center leading-tight max-w-[70px]">{label}</span>
    </div>
  )
}

export default function VerifierPanel({ captureTopView }) {
  const [planFile, setPlanFile] = useState(null)
  const [planPreview, setPlanPreview] = useState(null)
  const [renderPreview, setRenderPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('overlay') // overlay | diff | edges
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef()

  const handleFile = useCallback((file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (JPG, PNG, etc.)')
      return
    }
    setPlanFile(file)
    setError(null)
    const reader = new FileReader()
    reader.onload = (e) => setPlanPreview(e.target.result)
    reader.readAsDataURL(file)
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }, [handleFile])

  const runVerification = useCallback(async () => {
    if (!planFile) {
      setError('Please upload a floor plan image first.')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      // 1. Capture top-down Three.js render
      const renderDataUrl = captureTopView()
      if (!renderDataUrl) throw new Error('Could not capture 3D top view — load the model first.')
      setRenderPreview(renderDataUrl)

      // 2. Read plan file as base64
      const planB64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => resolve(e.target.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(planFile)
      })

      // 3. Send to backend
      const renderB64 = renderDataUrl.split(',')[1]
      const res = await fetch('http://localhost:8000/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_b64: planB64, render_b64: renderB64 }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Verification failed')
      }

      const data = await res.json()
      setResult(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [planFile, captureTopView])

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#0a0a0f]">
      {/* Header */}
      <div className="shrink-0 px-5 pt-5 pb-4 border-b border-white/5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">🔬</span>
          <h2 className="font-bold text-slate-100 text-sm">Accuracy Verifier</h2>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Upload your 2D floor plan drawing. The system captures a top-down screenshot of the 3D model
          and compares them using OpenCV edge analysis.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

        {/* Upload zone */}
        <div
          className={`relative rounded-xl border-2 border-dashed transition-all cursor-pointer p-4 text-center
            ${dragOver ? 'border-violet-400 bg-violet-400/10' : 'border-white/10 bg-white/[0.02] hover:border-violet-400/40 hover:bg-violet-400/5'}
          `}
          onClick={() => !planPreview && fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={e => handleFile(e.target.files[0])} />

          {planPreview ? (
            <div className="space-y-2">
              <img src={planPreview} alt="Floor plan" className="max-h-40 mx-auto rounded-lg object-contain" />
              <p className="text-xs text-slate-500">{planFile?.name}</p>
              <button
                className="text-xs text-slate-600 hover:text-red-400 transition-colors"
                onClick={(e) => { e.stopPropagation(); setPlanPreview(null); setPlanFile(null); setResult(null) }}
              >✕ Remove</button>
            </div>
          ) : (
            <div className="py-4 space-y-2">
              <div className="text-3xl">🏗️</div>
              <p className="text-sm text-slate-400">Drop floor plan image here</p>
              <p className="text-xs text-slate-600">or click to browse</p>
            </div>
          )}
        </div>

        {/* Run button */}
        <button
          onClick={runVerification}
          disabled={loading || !planFile}
          className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all
            ${planFile && !loading
              ? 'bg-gradient-to-r from-violet-600 to-cyan-500 text-white shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 hover:-translate-y-0.5'
              : 'bg-white/5 text-slate-600 cursor-not-allowed'
            }`}
        >
          {loading ? (
            <>
              <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
              Comparing...
            </>
          ) : (
            <>🔬 Run Verification</>
          )}
        </button>

        {/* Error */}
        {error && (
          <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            ⚠ {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4 animate-fade-in">
            {/* Score cards */}
            <div className="glass-sm p-4 rounded-xl">
              <p className="text-xs text-slate-500 mb-3 text-center">Accuracy Scores</p>
              <div className="flex justify-around">
                <ScoreRing score={result.overall_score} label="Overall Match" />
                <ScoreRing score={result.wall_edge_score} label="Wall Edges" color="#7c6fff" />
                <ScoreRing score={result.room_coverage_score} label="Room Coverage" color="#22d3a5" />
              </div>

              {/* Verdict */}
              <div className={`mt-4 px-3 py-2 rounded-lg text-xs text-center font-medium
                ${result.overall_score >= 70
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                  : result.overall_score >= 45
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                  : 'bg-red-500/15 text-red-400 border border-red-500/20'}`}
              >
                {result.overall_score >= 70
                  ? '✅ High accuracy — walls and rooms closely match the drawing'
                  : result.overall_score >= 45
                  ? '⚠️ Moderate accuracy — some walls may need adjustment'
                  : '❌ Low accuracy — significant discrepancies detected'}
              </div>
            </div>

            {/* Visual comparison tabs */}
            <div className="glass-sm rounded-xl overflow-hidden">
              <div className="flex border-b border-white/5">
                {[
                  { id: 'overlay', label: '🖼 Overlay' },
                  { id: 'diff',    label: '🌡 Heat Map' },
                  { id: 'edges',   label: '📐 Edges' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 py-2 text-xs font-medium transition-colors
                      ${activeTab === tab.id
                        ? 'text-violet-400 border-b-2 border-violet-400'
                        : 'text-slate-600 hover:text-slate-400'}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-2">
                {activeTab === 'overlay' && result.overlay_b64 && (
                  <div className="space-y-2">
                    <img
                      src={`data:image/png;base64,${result.overlay_b64}`}
                      alt="Overlay comparison"
                      className="w-full rounded-lg"
                    />
                    <p className="text-[10px] text-slate-600 text-center">
                      Left: Floor Plan · Middle: 3D Top View · Right: Blend (Cyan=Plan, Magenta=3D)
                    </p>
                  </div>
                )}

                {activeTab === 'diff' && result.diff_b64 && (
                  <div className="space-y-2">
                    <img
                      src={`data:image/png;base64,${result.diff_b64}`}
                      alt="Difference heatmap"
                      className="w-full rounded-lg"
                    />
                    <p className="text-[10px] text-slate-600 text-center">
                      Green = matching geometry · Red = mismatch
                    </p>
                  </div>
                )}

                {activeTab === 'edges' && result.plan_edges_b64 && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <img
                          src={`data:image/png;base64,${result.plan_edges_b64}`}
                          alt="Plan edges"
                          className="w-full rounded-lg"
                        />
                        <p className="text-[10px] text-slate-600 text-center mt-1">Plan Edges</p>
                      </div>
                      <div>
                        <img
                          src={`data:image/png;base64,${result.render_edges_b64}`}
                          alt="Render edges"
                          className="w-full rounded-lg"
                        />
                        <p className="text-[10px] text-slate-600 text-center mt-1">3D Render Edges</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Side-by-side raw images */}
            {renderPreview && planPreview && (
              <div className="glass-sm rounded-xl p-3 space-y-2">
                <p className="text-xs text-slate-500 font-medium">Raw Inputs</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <img src={planPreview} alt="Input plan" className="w-full rounded-lg object-contain max-h-32" />
                    <p className="text-[10px] text-slate-600 text-center mt-1">Your Drawing</p>
                  </div>
                  <div>
                    <img src={renderPreview} alt="3D render" className="w-full rounded-lg object-contain max-h-32" />
                    <p className="text-[10px] text-slate-600 text-center mt-1">3D Top View</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
