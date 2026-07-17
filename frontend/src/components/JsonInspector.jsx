/**
 * JsonInspector.jsx — Collapsible JSON viewer with confidence coloring.
 * Shows raw Gemini output. Amber highlights for flagged elements.
 */
import { useState, useMemo } from 'react'

function ConfBadge({ value }) {
  if (value === undefined || value === null) return null
  const cls = value >= 0.8 ? 'conf-high' : value >= 0.6 ? 'conf-mid' : 'conf-low'
  return <span className={cls}>{value.toFixed(2)}</span>
}

function WallRow({ wall }) {
  return (
    <div className={`flex items-start gap-3 py-2 px-3 rounded-lg transition-colors ${wall.flagged ? 'bg-amber-500/10 border border-amber-500/20' : 'hover:bg-white/3'}`}>
      <span className="text-slate-500 font-mono text-xs w-8 shrink-0">{wall.id}</span>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap gap-1 text-xs font-mono text-slate-400">
          <span>[{wall.start?.map(v => Math.round(v)).join(',')}]</span>
          <span className="text-slate-600">→</span>
          <span>[{wall.end?.map(v => Math.round(v)).join(',')}]</span>
          <span className="text-slate-600 ml-1">t:{wall.thickness_px}px</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {wall.flagged && <span className="text-amber-400 text-xs">⚑</span>}
        <ConfBadge value={wall.confidence} />
      </div>
    </div>
  )
}

function RoomRow({ room }) {
  const [open, setOpen] = useState(false)
  const typeColors = {
    bedroom: 'text-purple-400', bathroom: 'text-blue-400', kitchen: 'text-orange-400',
    living_room: 'text-green-400', dining_room: 'text-yellow-400', hallway: 'text-slate-400',
    closet: 'text-amber-600', garage: 'text-slate-500', other: 'text-slate-400',
  }
  return (
    <div className={`rounded-lg transition-colors ${room.flagged ? 'bg-amber-500/10 border border-amber-500/20' : ''}`}>
      <button
        className="w-full flex items-center gap-3 py-2 px-3 hover:bg-white/3 rounded-lg text-left"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-slate-500 font-mono text-xs w-8 shrink-0">{room.id}</span>
        <span className={`font-medium text-sm flex-1 ${typeColors[room.type] || 'text-slate-300'}`}>{room.name}</span>
        <span className="text-xs text-slate-600 mr-2">{room.type}</span>
        {room.flagged && <span className="text-amber-400 text-xs mr-1">⚑</span>}
        <ConfBadge value={room.confidence} />
        <span className="text-slate-600 text-xs ml-1">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-3 pb-2">
          <div className="font-mono text-xs text-slate-600 bg-dark-800 rounded p-2 overflow-x-auto">
            {room.polygon?.map((pt, i) => (
              <span key={i} className="mr-2">[{pt.map(v => Math.round(v)).join(',')}]</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function JsonInspector({ rawPlan, validatedPlan }) {
  const [tab, setTab] = useState('validated')
  const [section, setSection] = useState('rooms')
  const plan = tab === 'raw' ? rawPlan : validatedPlan

  const warnings = validatedPlan?.validation_warnings || []
  const flaggedCount = [
    ...(validatedPlan?.walls || []),
    ...(validatedPlan?.rooms || []),
  ].filter(x => x.flagged).length

  const tabs = [
    { id: 'validated', label: 'Validated JSON' },
    { id: 'raw',       label: 'Raw Gemini Output' },
  ]
  const sections = [
    { id: 'rooms',   label: `Rooms (${plan?.rooms?.length || 0})` },
    { id: 'walls',   label: `Walls (${plan?.walls?.length || 0})` },
    { id: 'openings',label: `Doors/Windows (${(plan?.doors?.length || 0) + (plan?.windows?.length || 0)})` },
    { id: 'meta',    label: 'Scale & Meta' },
  ]

  return (
    <div className="glass rounded-2xl overflow-hidden animate-fade-in h-full flex flex-col">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 border-b border-white/5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-200 flex items-center gap-2">
            <span className="text-accent">⬡</span> JSON Analysis
          </h3>
          {flaggedCount > 0 && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
              ⚑ {flaggedCount} flagged
            </span>
          )}
        </div>
        {/* Tab switch */}
        <div className="flex gap-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${tab === t.id ? 'bg-accent text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 px-5 py-2 border-b border-white/5 overflow-x-auto">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`px-2.5 py-1 rounded text-xs whitespace-nowrap transition-all ${section === s.id ? 'text-accent-light bg-accent/10' : 'text-slate-600 hover:text-slate-400'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
        {section === 'rooms' && plan?.rooms?.map(r => <RoomRow key={r.id} room={r} />)}
        {section === 'walls' && plan?.walls?.map(w => <WallRow key={w.id} wall={w} />)}
        {section === 'openings' && (
          <div className="space-y-1">
            {[...(plan?.doors || []).map(d => ({...d, _k:'door'})),
               ...(plan?.windows || []).map(w => ({...w, _k:'window'}))].map(o => (
              <div key={o.id} className={`flex items-center gap-3 py-2 px-3 rounded-lg ${o.flagged ? 'bg-amber-500/10 border border-amber-500/20' : 'hover:bg-white/3'}`}>
                <span className="text-lg">{o._k === 'door' ? '🚪' : '🪟'}</span>
                <span className="font-mono text-xs text-slate-500 w-10">{o.id}</span>
                <span className="text-xs text-slate-400 flex-1">wall: {o.wall_id} · pos: {(o.position_ratio*100).toFixed(0)}% · {o.width_px}px wide</span>
                {o.flagged && <span className="text-amber-400 text-xs">⚑</span>}
              </div>
            ))}
          </div>
        )}
        {section === 'meta' && plan && (
          <div className="space-y-3 text-sm">
            <div className="glass-sm p-4 space-y-2">
              <p className="text-slate-500 text-xs uppercase tracking-wider font-medium mb-3">Image Size</p>
              <div className="flex justify-between font-mono text-xs">
                <span className="text-slate-400">Width</span>
                <span className="text-slate-200">{plan.image_size?.width_px}px</span>
              </div>
              <div className="flex justify-between font-mono text-xs">
                <span className="text-slate-400">Height</span>
                <span className="text-slate-200">{plan.image_size?.height_px}px</span>
              </div>
            </div>
            <div className="glass-sm p-4 space-y-2">
              <p className="text-slate-500 text-xs uppercase tracking-wider font-medium mb-3">Scale Reference</p>
              <div className="flex justify-between font-mono text-xs">
                <span className="text-slate-400">Pixels / Metre</span>
                <span className="text-slate-200">
                  {plan.scale_reference ? (plan.scale_reference.pixels / plan.scale_reference.meters).toFixed(1) : '100.0'}
                </span>
              </div>
              <div className="flex justify-between font-mono text-xs">
                <span className="text-slate-400">Confidence</span>
                <ConfBadge value={plan.scale_reference?.confidence} />
              </div>
            </div>
            {warnings.length > 0 && (
              <div className="glass-sm p-4">
                <p className="text-slate-500 text-xs uppercase tracking-wider font-medium mb-2">Validation Warnings</p>
                <ul className="space-y-1">
                  {warnings.map((w, i) => (
                    <li key={i} className="text-xs text-amber-400/80 flex gap-2">
                      <span>⚠</span><span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
