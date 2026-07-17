/**
 * App.jsx — Load JSON → Render 3D Model. Nothing else.
 */
import React, { useState, useRef, useCallback } from 'react'
import Viewer from './three/Viewer.jsx'

export default function App() {
  const [screen, setScreen] = useState('LANDING')
  const [planData, setPlanData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [viewMode, setViewMode] = useState('orbit')
  const [showRoof, setShowRoof] = useState(false)
  const [activeRoom, setActiveRoom] = useState(null)
  const [parsedRooms, setParsedRooms] = useState(null)
  const viewerRef = useRef()

  const handleUpload = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const res = await fetch('http://127.0.0.1:8000/pipeline', {
        method: 'POST',
        body: formData
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Pipeline failed: ${text}`)
      }
      const data = await res.json()
      
      // Use the validated plan
      setPlanData(data.validated_plan || data.raw_plan)
      setScreen('VIEWER')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
      setParsedRooms(null)
    }
  }, [])

  const toggleMode = useCallback(() => {
    setViewMode(m => {
      const next = m === 'orbit' ? 'walkthrough' : 'orbit'
      setShowRoof(next === 'walkthrough')
      return next
    })
  }, [])

  // ── LANDING ───────────────────────────────────────────────
  if (screen === 'LANDING') {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center relative" style={{ background: '#0a0a0f' }}>
        <div className="pointer-events-none absolute inset-0 opacity-15"
          style={{ backgroundImage: 'linear-gradient(rgba(124,111,255,0.25) 1px,transparent 1px),linear-gradient(90deg,rgba(124,111,255,0.25) 1px,transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(124,111,255,0.12) 0%, transparent 70%)' }} />

        <div className="relative z-10 text-center space-y-8 max-w-lg px-6">
          <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-3xl shadow-2xl"
            style={{ background: 'linear-gradient(135deg, #7c6fff, #22d3a5)' }}>⬡</div>
          <div>
            <h1 className="text-6xl font-bold tracking-tight mb-3"
              style={{ background: 'linear-gradient(135deg, #fff, #a89fff 50%, #7c6fff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              FloorPlan 3D
            </h1>
            <p className="text-lg text-slate-400">JSON → Accurate 3D Model</p>
          </div>

          <div className="relative">
            <input
              type="file"
              accept="image/*"
              onChange={handleUpload}
              disabled={loading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
            />
            <button disabled={loading}
              className="btn-accent w-full py-5 text-lg flex items-center justify-center gap-3 relative z-10 pointer-events-none">
              {loading
                ? <><span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />Processing Image...</>
                : <>Upload Floor Plan Image</>}
            </button>
          </div>
          {error && <div className="px-4 py-3 rounded-xl text-sm text-red-400 border border-red-500/30 bg-red-500/10">⚠ {error}</div>}
        </div>
      </div>
    )
  }

  // ── VIEWER ────────────────────────────────────────────────
  return (
    <div className="h-screen w-screen flex flex-col" style={{ background: '#0a0a0f' }}>
      {/* Navbar */}
      <header className="shrink-0 h-12 flex items-center justify-between px-4 border-b border-white/5 z-20"
        style={{ background: 'rgba(10,10,15,0.9)', backdropFilter: 'blur(12px)', borderRadius: 0 }}>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
            style={{ background: 'linear-gradient(135deg, #7c6fff, #22d3a5)' }}>⬡</div>
          <span className="font-bold text-slate-100 text-sm">FloorPlan 3D</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowRoof(p => !p)}
            className={`hud-pill text-xs ${showRoof ? 'text-violet-400' : 'text-slate-500'}`}>
            🏠 Roof {showRoof ? 'On' : 'Off'}
          </button>
          <button onClick={toggleMode} className="btn-accent text-xs py-1.5 px-4">
            {viewMode === 'orbit' ? '🚶 Walk' : '🔭 Orbit'}
          </button>
          <button onClick={() => setScreen('LANDING')} className="btn-ghost text-xs py-1.5 px-3">← Back</button>
        </div>
      </header>

      {/* 3D Canvas */}
      <div className="flex-1 relative">
        <Viewer
          ref={viewerRef}
          plan={planData}
          viewMode={viewMode}
          showRoof={showRoof}
          onRoomEnter={setActiveRoom}
          onRoomsParsed={setParsedRooms}
        />

        <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
          {(parsedRooms || planData?.rooms || []).map((room, idx) => (
            <button key={room.id || `${room.name}-${idx}`}
              onClick={() => viewerRef.current?.flyToRoom(room.name)}
              className={`w-40 text-left px-3 py-2 rounded-lg text-xs border transition-all
                ${activeRoom === room.name
                  ? 'bg-violet-500/20 border-violet-400/50 text-violet-300'
                  : 'bg-black/50 border-white/5 text-slate-400 hover:text-slate-200'}`}
              style={{ backdropFilter: 'blur(8px)' }}>
              <div className="font-semibold">{room.name}</div>
              <div className="text-[10px] text-slate-600">
                {room.computedW && room.computedD ? `${room.computedW.toFixed(1)}m × ${room.computedD.toFixed(1)}m · ` : ''}
                {room.computedArea ? Math.round(room.computedArea * 10.764) : room.area_sq_ft} sq ft
              </div>
            </button>
          ))}
        </div>

        {activeRoom && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none z-10">
            <div className="hud-pill text-slate-200 text-sm font-medium px-5 py-2">📍 {activeRoom}</div>
          </div>
        )}

        <div className="absolute bottom-4 left-4 z-10">
          <div className="glass-sm px-3 py-2 text-xs text-slate-500">
            {viewMode === 'walkthrough'
              ? <>WASD to move · Esc to release</>
              : <>🖱 Drag to orbit · Scroll to zoom</>}
          </div>
        </div>
      </div>
    </div>
  )
}
