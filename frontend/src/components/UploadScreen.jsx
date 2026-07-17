/**
 * UploadScreen.jsx — Drag-drop file upload + demo plan loader
 */
import { useState, useRef, useCallback } from 'react'

const DEMO_PLANS = [
  { id: 'simple',   label: 'Simple 2-Bed',     file: '/demo-plans/simple.png',   desc: '2 bedrooms · 1 bath · kitchen' },
  { id: 'medium',   label: 'Family Home',       file: '/demo-plans/medium.png',   desc: '3 bedrooms · 2 baths · living room' },
  { id: 'open',     label: 'Open Plan Studio',  file: '/demo-plans/studio.png',   desc: 'Open layout · kitchen · bathroom' },
]

const ROOM_ICONS = {
  'Simple 2-Bed': '🏠', 'Family Home': '🏡', 'Open Plan Studio': '🏢',
}

export default function UploadScreen({ onUpload }) {
  const [dragOver, setDragOver] = useState(false)
  const [preview, setPreview] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [error, setError] = useState(null)
  const fileInputRef = useRef()

  const handleFile = useCallback((file) => {
    setError(null)
    if (!file) return
    const valid = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/bmp']
    if (!valid.includes(file.type)) {
      setError('Please upload a JPG, PNG, WebP, or BMP image.')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('File too large — max 20 MB.')
      return
    }
    setSelectedFile(file)
    const url = URL.createObjectURL(file)
    setPreview(url)
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    handleFile(file)
  }, [handleFile])

  const handleDemoLoad = useCallback(async (demo) => {
    setError(null)
    try {
      const res = await fetch(demo.file)
      if (!res.ok) throw new Error('Demo file not found')
      const blob = await res.blob()
      const file = new File([blob], `${demo.id}.png`, { type: 'image/png' })
      handleFile(file)
    } catch (e) {
      setError(`Could not load demo: ${e.message}`)
    }
  }, [handleFile])

  const handleSubmit = useCallback(() => {
    if (!selectedFile) return
    onUpload(selectedFile)
  }, [selectedFile, onUpload])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 animate-fade-in">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 glass-sm text-accent-light text-xs font-medium tracking-wider uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-slow inline-block" />
          Powered by Gemini Vision
        </div>
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-4"
          style={{ background: 'linear-gradient(135deg, #e8e8ff 0%, #a89fff 50%, #7c6fff 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          FloorPlan 3D
        </h1>
        <p className="text-lg text-slate-400 max-w-md mx-auto leading-relaxed">
          Upload any 2D floor plan — scanned, photographed, or digital.
          <br />AI understands it. Three.js renders it. You walk through it.
        </p>
      </div>

      <div className="w-full max-w-2xl space-y-6">
        {/* Drop zone */}
        <div
          className={`upload-zone p-12 text-center ${dragOver ? 'drag-over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !preview && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => handleFile(e.target.files[0])}
          />

          {preview ? (
            <div className="space-y-4">
              <img src={preview} alt="Floor plan preview" className="max-h-52 mx-auto rounded-xl object-contain ring-2 ring-accent/30" />
              <p className="text-sm text-slate-400">{selectedFile?.name} — {(selectedFile?.size / 1024).toFixed(0)} KB</p>
              <button
                className="text-xs text-slate-500 hover:text-accent-light transition-colors"
                onClick={(e) => { e.stopPropagation(); setPreview(null); setSelectedFile(null) }}
              >
                ✕ Remove
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-3xl animate-float"
                style={{ background: 'linear-gradient(135deg, rgba(124,111,255,0.2), rgba(90,79,214,0.1))' }}>
                🏗️
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-200">Drop your floor plan here</p>
                <p className="text-sm text-slate-500 mt-1">or click to browse — JPG, PNG, WebP supported</p>
              </div>
              <div className="flex items-center gap-3 justify-center">
                <span className="h-px flex-1 bg-white/10" />
                <span className="text-xs text-slate-600">or try a demo</span>
                <span className="h-px flex-1 bg-white/10" />
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            ⚠ {error}
          </div>
        )}

        {/* Demo plans */}
        <div className="grid grid-cols-3 gap-3">
          {DEMO_PLANS.map(demo => (
            <button
              key={demo.id}
              onClick={() => handleDemoLoad(demo)}
              className="btn-ghost text-left p-4 rounded-xl space-y-1 group"
            >
              <div className="text-xl mb-1">{ROOM_ICONS[demo.label] || '🏠'}</div>
              <div className="text-xs font-semibold text-slate-200 group-hover:text-accent-light transition-colors">{demo.label}</div>
              <div className="text-xs text-slate-600">{demo.desc}</div>
            </button>
          ))}
          
          <button
            onClick={() => {
              // Fire a custom event that App.jsx can listen to
              window.dispatchEvent(new CustomEvent('loadCustomJson'))
            }}
            className="btn-ghost border border-cyan-400/30 text-left p-4 rounded-xl space-y-1 group hover:border-cyan-400"
          >
            <div className="text-xl mb-1">🛠️</div>
            <div className="text-xs font-semibold text-cyan-400">Custom JSON</div>
            <div className="text-xs text-slate-600">Test specific schema</div>
          </button>
        </div>

        {/* CTA */}
        {selectedFile && (
          <button
            onClick={handleSubmit}
            className="btn-accent w-full py-4 text-base flex items-center justify-center gap-3 animate-slide-up"
          >
            <span>Analyze & Generate 3D</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        )}

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          {['OpenCV deskew', 'Gemini Vision AI', 'Live JSON preview', 'Orbit + Walkthrough', 'WASD movement'].map(f => (
            <span key={f} className="hud-pill text-slate-500">{f}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
