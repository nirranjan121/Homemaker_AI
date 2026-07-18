import { useState, useRef, useEffect } from 'react'
import { chatBot } from '../api'

export default function ChatbotPanel({ planData, onMaterialChange }) {
  const [isOpen, setIsOpen] = useState(false)
  const [history, setHistory] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [history, loading])

  const handleSend = async () => {
    if (!input.trim() || !planData) return
    const userMsg = input.trim()
    setInput('')
    setError(null)
    setHistory(prev => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)
    
    try {
      const data = await chatBot({
        plan_json: planData,
        question: userMsg,
        history: history
      })
      
      let answerText = data.answer;
      
      // FAULT TOLERANT PARSING: We don't care if the JSON is valid.
      // We just look for patterns like: "room_name": "bath", "floor_color": "#FFEB3B"
      const commandRegex = /"room_name"\s*:\s*"([^"]+)"\s*,\s*"floor_color"\s*:\s*"([^"]+)"/g;
      let matchCmd;
      let commandsFound = false;
      
      while ((matchCmd = commandRegex.exec(answerText)) !== null) {
        const roomName = matchCmd[1];
        const floorColor = matchCmd[2];
        if (roomName && floorColor) {
          onMaterialChange(roomName, floorColor);
          commandsFound = true;
        }
      }

      // Strip ALL code blocks (```...```) from the text shown to the user
      // so they don't see raw code/json snippets even if it's malformed.
      let strippedText = answerText.replace(/```[\s\S]*?```/g, '').trim();
      
      // If the AI left dangling JSON brackets because it got cut off, aggressively strip them
      if (strippedText.includes('```')) {
         strippedText = strippedText.split('```')[0].trim();
      }

      setHistory(prev => [...prev, { role: 'assistant', content: strippedText || "Done!" }])
    } catch (err) {
      setError(err.message)
      setHistory(prev => prev.slice(0, -1)) // revert the optimistic user message
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`bg-black/50 rounded-xl border border-white/10 backdrop-blur-md flex flex-col overflow-hidden text-white w-80 transition-all duration-300 ${isOpen ? 'h-96' : 'h-auto'}`}>
      <div 
        className="bg-violet-900/50 p-3 font-bold border-b border-white/10 flex justify-between items-center cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>AI Architect Assistant</span>
        <span className="text-slate-400 font-normal">{isOpen ? '▼' : '▲'}</span>
      </div>
      
      {isOpen && (
        <>
          <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-3 text-sm" ref={scrollRef}>
            {history.length === 0 && (
              <div className="text-slate-400 text-center mt-10">
                {planData ? "Ask me anything about your floor plan!" : "Upload a floor plan to start chatting."}
              </div>
            )}
            {history.map((msg, i) => (
              <div key={i} className={`max-w-[85%] p-2 rounded-lg ${msg.role === 'user' ? 'bg-violet-600/50 self-end' : 'bg-white/10 self-start'}`}>
                {msg.content}
              </div>
            ))}
            {loading && <div className="text-slate-400 text-xs italic">AI is typing...</div>}
            {error && <div className="text-red-400 text-xs text-center">{error}</div>}
          </div>

          <div className="p-3 border-t border-white/10 flex gap-2">
            <input 
              className="flex-1 bg-black/40 border border-white/20 rounded-full px-3 py-1.5 text-sm"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask a question..."
              disabled={!planData || loading}
            />
            <button 
              onClick={handleSend}
              disabled={!planData || loading || !input.trim()}
              className="bg-violet-600 hover:bg-violet-500 rounded-full w-8 h-8 flex items-center justify-center disabled:opacity-50"
            >
              ↑
            </button>
          </div>
        </>
      )}
    </div>
  )
}
