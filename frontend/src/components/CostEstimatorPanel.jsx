import { useState } from 'react'
import { estimateCost } from '../api'

export default function CostEstimatorPanel({ planData }) {
  const [isOpen, setIsOpen] = useState(false)
  const [location, setLocation] = useState('Bengaluru')
  const [quality, setQuality] = useState('standard')
  const [floors, setFloors] = useState(1)
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState(null)
  const [error, setError] = useState(null)

  const handleEstimate = async () => {
    if (!planData) {
      setError("Please upload and analyze a floor plan first.")
      return
    }
    setLoading(true)
    setError(null)
    setReport(null)
    try {
      // the backend endpoint `/estimate-cost` takes `plan_json`
      const data = await estimateCost({
        plan_json: planData,
        location,
        quality,
        floors
      })
      setReport(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-black/50 p-4 rounded-xl border border-white/10 backdrop-blur-md text-white w-80">
      <div 
        className="flex justify-between items-center cursor-pointer mb-2"
        onClick={() => setIsOpen(!isOpen)}
      >
        <h2 className="text-lg font-bold">AI Cost Estimator</h2>
        <span className="text-slate-400">{isOpen ? '▼' : '▲'}</span>
      </div>
      
      {isOpen && (
        <div className="flex flex-col gap-3 mt-4">
        <input 
          className="bg-black/40 border border-white/20 rounded p-2 text-sm" 
          value={location} 
          onChange={(e) => setLocation(e.target.value)} 
          placeholder="Location (e.g., Bengaluru)"
        />
        <select 
          className="bg-black/40 border border-white/20 rounded p-2 text-sm"
          value={quality}
          onChange={(e) => setQuality(e.target.value)}
        >
          <option value="basic">Basic Quality</option>
          <option value="standard">Standard Quality</option>
          <option value="premium">Premium Quality</option>
        </select>
        <input 
          className="bg-black/40 border border-white/20 rounded p-2 text-sm" 
          type="number" 
          min="1"
          value={floors} 
          onChange={(e) => setFloors(parseInt(e.target.value))} 
          placeholder="Floors"
        />
        <button 
          onClick={handleEstimate} 
          disabled={loading || !planData}
          className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold py-2 rounded transition-colors"
        >
          {loading ? 'Estimating...' : 'Generate Estimate'}
        </button>

        {error && <div className="mt-4 text-red-400 text-sm">{error}</div>}

        {report && (
          <div className="mt-4 text-sm bg-black/30 p-3 rounded border border-white/5 max-h-64 overflow-y-auto">
            <div className="font-bold text-violet-300 mb-1">Estimated Cost ({report.inputs.currency})</div>
            <div>Location: {report.location.city}</div>
            <div>Total Area: {report.inputs.houseAreaSqFt} sq ft</div>
            <div className="my-2 border-b border-white/10"></div>
            <div className="font-semibold">Construction Cost:</div>
            <div>Low: ₹{report.constructionCost.low.toLocaleString()}</div>
            <div>High: ₹{report.constructionCost.high.toLocaleString()}</div>
            <div className="my-2 border-b border-white/10"></div>
            <div className="font-semibold text-xs text-slate-400 mt-2">Disclaimer:</div>
            <div className="text-[10px] text-slate-500">{report.disclaimer}</div>
          </div>
        )}
      </div>
      )}
    </div>
  )
}
