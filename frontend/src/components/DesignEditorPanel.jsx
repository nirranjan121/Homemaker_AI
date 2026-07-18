import { useState } from 'react'

export default function DesignEditorPanel({ parsedRooms, roomMaterials, onMaterialChange }) {
  const [isOpen, setIsOpen] = useState(false)

  // Deduplicate parsedRooms in case multiple regions matched the same room
  const uniqueRooms = [];
  const seen = new Set();
  if (parsedRooms) {
    for (const room of parsedRooms) {
      if (!seen.has(room.name)) {
        seen.add(room.name);
        uniqueRooms.push(room);
      }
    }
  }

  if (!parsedRooms || uniqueRooms.length === 0) return null;

  return (
    <div className={`bg-black/50 rounded-xl border border-white/10 backdrop-blur-md flex flex-col overflow-hidden text-white w-72 transition-all duration-300 ${isOpen ? 'max-h-96' : 'h-auto'}`}>
      <div 
        className="bg-sky-900/50 p-3 font-bold border-b border-white/10 flex justify-between items-center cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>🎨 Design Editor</span>
        <span className="text-slate-400 font-normal">{isOpen ? '▼' : '▲'}</span>
      </div>
      
      {isOpen && (
        <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-3 text-sm">
          <p className="text-slate-300 text-xs mb-2">Select a room to change its floor color:</p>
          {uniqueRooms.map((room, i) => {
            // Find current color or default to white
            let currentColor = "#ffffff";
            const roomKey = Object.keys(roomMaterials).find(k => k.toLowerCase() === room.name.toLowerCase());
            if (roomKey && roomMaterials[roomKey]) {
              currentColor = roomMaterials[roomKey];
            }

            return (
              <div key={i} className="flex justify-between items-center bg-white/5 p-2 rounded-lg border border-white/5">
                <span className="truncate pr-2">{room.name}</span>
                <input 
                  type="color" 
                  value={currentColor.length === 7 ? currentColor : "#ffffff"} 
                  onChange={(e) => onMaterialChange(room.name, e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
