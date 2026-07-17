/**
 * RoomSidebar.jsx — Room list with click-to-fly and active room highlight.
 */

const ROOM_ICONS = {
  bedroom:     '🛏',
  bathroom:    '🛁',
  kitchen:     '🍳',
  living_room: '🛋',
  dining_room: '🍽',
  hallway:     '🚶',
  closet:      '👕',
  garage:      '🚗',
  other:       '🏠',
}

const ROOM_COLORS = {
  bedroom:     'text-purple-400 bg-purple-500/10 border-purple-500/20',
  bathroom:    'text-blue-400   bg-blue-500/10   border-blue-500/20',
  kitchen:     'text-orange-400 bg-orange-500/10 border-orange-500/20',
  living_room: 'text-green-400  bg-green-500/10  border-green-500/20',
  dining_room: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  hallway:     'text-slate-400  bg-slate-500/10  border-slate-500/20',
  closet:      'text-amber-600  bg-amber-600/10  border-amber-600/20',
  garage:      'text-slate-500  bg-slate-600/10  border-slate-600/20',
  other:       'text-slate-400  bg-slate-500/10  border-slate-500/20',
}

export default function RoomSidebar({ rooms, activeRoomId, onRoomClick }) {
  return (
    <div className="glass h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-4 border-b border-white/5">
        <h3 className="text-xs uppercase tracking-widest text-slate-600 font-semibold">Rooms</h3>
        <p className="text-xs text-slate-700 mt-0.5">{rooms.length} detected</p>
      </div>

      {/* Room list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
        {rooms.map(room => {
          const isActive = room.id === activeRoomId
          const colorCls = ROOM_COLORS[room.type] || ROOM_COLORS.other

          return (
            <button
              key={room.id}
              onClick={() => onRoomClick(room.id)}
              className={`
                w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left
                transition-all duration-200 border
                ${isActive
                  ? `${colorCls} shadow-sm scale-[1.02]`
                  : 'border-transparent hover:bg-white/5 text-slate-400 hover:text-slate-200'
                }
              `}
            >
              <span className="text-xl shrink-0 leading-none">
                {ROOM_ICONS[room.type] || '🏠'}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-sm truncate ${isActive ? '' : 'text-slate-300'}`}>
                  {room.name}
                </p>
                <p className="text-xs text-slate-600 capitalize">
                  {(room.type || 'room').replace(/_/g, ' ')}
                </p>
              </div>
              {room.flagged && (
                <span className="text-amber-400 text-xs shrink-0" title="Low confidence">⚑</span>
              )}
              {isActive && (
                <span className="shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="opacity-60">
                    <circle cx="12" cy="12" r="5"/>
                  </svg>
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-3 border-t border-white/5">
        <p className="text-xs text-slate-700 text-center">Click a room to fly there</p>
      </div>
    </div>
  )
}
