/**
 * ProcessingScreen.jsx — Step-by-step pipeline progress with JSON reveal.
 */
import { useEffect, useState } from 'react'
import { runFullPipeline } from '../api.js'
import JsonInspector from './JsonInspector.jsx'

const STEPS = [
  { id: 'preprocess', label: 'OpenCV Preprocessing',    detail: 'Grayscaling · denoising · deskewing · resizing' },
  { id: 'analyze',    label: 'Gemini Vision Analysis',  detail: 'Extracting walls · rooms · doors · windows' },
  { id: 'validate',   label: 'Geometry Validation',     detail: 'Bounds check · angle snap · Hough cross-check' },
  { id: 'build',      label: 'Building 3D Scene',       detail: 'Extruding walls · laying floors · placing labels' },
]

function StepRow({ step, status, index }) {
  return (
    <div className={`flex items-start gap-4 py-3 transition-all duration-500 ${status === 'pending' ? 'opacity-40' : ''}`}>
      <div className={`step-dot shrink-0 mt-0.5 ${status}`}>
        {status === 'done' ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        ) : status === 'running' ? (
          <svg className="animate-spin-slow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
        ) : (
          <span className="text-slate-600">{index + 1}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-medium text-sm ${status === 'done' ? 'text-success' : status === 'running' ? 'text-accent-light' : 'text-slate-500'}`}>
          {step.label}
        </p>
        {status !== 'pending' && (
          <p className="text-xs text-slate-600 mt-0.5">{step.detail}</p>
        )}
      </div>
      {status === 'running' && (
        <div className="flex gap-1 items-center mt-1">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      )}
    </div>
  )
}

export default function ProcessingScreen({ file, onComplete, onBack }) {
  const [stepStatuses, setStepStatuses] = useState(['pending', 'pending', 'pending', 'pending'])
  const [rawPlan, setRawPlan] = useState(null)
  const [validatedPlan, setValidatedPlan] = useState(null)
  const [error, setError] = useState(null)
  const [showJson, setShowJson] = useState(false)

  const setStep = (i, status) =>
    setStepStatuses(prev => { const n = [...prev]; n[i] = status; return n })

  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        const result = await runFullPipeline(file, (stepIdx, status) => {
          if (!cancelled) setStep(stepIdx, status)
          if (stepIdx === 1 && status === 'done') {
            // JSON is ready — show inspector
            setShowJson(true)
          }
        })

        if (cancelled) return
        setRawPlan(result.rawPlan)
        setValidatedPlan(result.validatedPlan)

        // Step 4: building 3D (client side — just visual feedback)
        setStep(3, 'running')
        await new Promise(r => setTimeout(r, 600))
        setStep(3, 'done')

        setTimeout(() => {
          if (!cancelled) onComplete(result)
        }, 800)

      } catch (err) {
        if (!cancelled) setError(err.message)
      }
    }

    run()
    return () => { cancelled = true }
  }, [file])

  const allDone = stepStatuses.every(s => s === 'done')

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 animate-fade-in">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-slate-100 mb-2">Analyzing your floor plan…</h2>
          <p className="text-slate-500 text-sm">Gemini Vision is reading walls, rooms, doors & windows</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Steps */}
          <div className="glass p-6 space-y-1">
            <h3 className="text-xs uppercase tracking-widest text-slate-600 font-semibold mb-4">Pipeline Progress</h3>
            {STEPS.map((step, i) => (
              <StepRow key={step.id} step={step} status={stepStatuses[i]} index={i} />
            ))}

            {/* Overall progress bar */}
            <div className="mt-6 pt-4 border-t border-white/5">
              <div className="h-1.5 bg-dark-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${(stepStatuses.filter(s => s === 'done').length / STEPS.length) * 100}%`,
                    background: 'linear-gradient(90deg, #7c6fff, #22d3a5)',
                  }}
                />
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-xs text-slate-600">{stepStatuses.filter(s => s === 'done').length}/{STEPS.length} complete</span>
                {allDone && <span className="text-xs text-success font-medium">✓ Ready</span>}
              </div>
            </div>
          </div>

          {/* JSON reveal */}
          <div className="glass p-6 flex flex-col">
            {showJson && rawPlan ? (
              <JsonInspector rawPlan={rawPlan} validatedPlan={validatedPlan || rawPlan} />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
                <div className="w-12 h-12 rounded-xl shimmer" />
                <div className="w-32 h-3 rounded-full shimmer" />
                <div className="w-24 h-3 rounded-full shimmer opacity-50" />
                <p className="text-xs text-slate-600 mt-2">JSON output will appear here after AI analysis…</p>
              </div>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 space-y-3 animate-fade-in">
            <p className="font-semibold text-sm">⚠ Pipeline Error</p>
            <p className="text-sm opacity-80">{error}</p>
            <button onClick={onBack} className="btn-ghost text-sm">← Try another file</button>
          </div>
        )}
      </div>
    </div>
  )
}
