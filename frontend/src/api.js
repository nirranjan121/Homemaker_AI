/**
 * api.js — Typed fetch wrappers for the FastAPI backend
 */

const BASE = import.meta.env.VITE_API_URL || '/api'

export async function preprocessImage(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/preprocess`, { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Preprocessing failed')
  }
  return res.json()
}

export async function analyzeFloorPlan({ image_b64, width, height, mime_type }) {
  const res = await fetch(`${BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_b64, width, height, mime_type }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Gemini analysis failed')
  }
  return res.json()
}

export async function validatePlan({ plan, image_b64 }) {
  const res = await fetch(`${BASE}/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan, image_b64 }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Validation failed')
  }
  return res.json()
}

export async function runFullPipeline(file, onStep) {
  // Step 1: preprocess
  onStep(0, 'running')
  const preprocessed = await preprocessImage(file)
  onStep(0, 'done')

  // Step 2: analyze
  onStep(1, 'running')
  const rawPlan = await analyzeFloorPlan(preprocessed)
  onStep(1, 'done')

  // Step 3: validate
  onStep(2, 'running')
  const validatedPlan = await validatePlan({ plan: rawPlan, image_b64: preprocessed.image_b64 })
  onStep(2, 'done')

  return { preprocessed, rawPlan, validatedPlan }
}

export async function estimateCost(payload) {
  const res = await fetch(`${BASE}/estimate-cost`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Cost estimation failed')
  }
  return res.json()
}

export async function chatBot(payload) {
  const res = await fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Chat failed')
  }
  return res.json()
}
