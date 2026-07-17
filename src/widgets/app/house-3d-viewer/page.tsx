"use client";

import React, { useEffect, useRef, useState } from 'react';
import { buildHouseScene, type SceneHandle } from './scene';
import type { RoomShape, FloorMaterial, CostEstimate } from '../../../modules/houseplan/houseplan.types';

// NOTE ON WIRING: this assumes @nitrostack/widgets passes the tool's
// return value straight through as this component's props (that's the
// pattern shown for @Widget-decorated tools/resources in the NitroStack
// docs). Check your installed @nitrostack/widgets version's guide — if it
// instead exposes props via a hook (e.g. useToolOutput()) rather than
// direct props, swap the two lines below accordingly; nothing else in
// this file needs to change.
export interface HouseViewerProps {
  rooms: RoomShape[];
  wallColorHex?: string;
  floorMaterials?: Record<string, FloorMaterial>;
  costEstimate?: CostEstimate | null;
}

const MATERIAL_OPTIONS: { key: FloorMaterial; label: string }[] = [
  { key: 'oak', label: 'Oak wood' },
  { key: 'tile', label: 'Ceramic tile' },
  { key: 'concrete', label: 'Concrete' },
  { key: 'carpet', label: 'Carpet' },
];

export default function HouseViewer(props: any) {
  const typedProps = (props ?? {}) as HouseViewerProps;
  const rooms = typedProps.rooms ?? [];
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneHandle | null>(null);

  const [wallColorHex, setWallColorHex] = useState(typedProps.wallColorHex ?? '#e8e4dc');
  const [floorMaterials, setFloorMaterials] = useState<Record<string, FloorMaterial>>(
    typedProps.floorMaterials ?? Object.fromEntries(rooms.map((r) => [r.id, 'oak' as FloorMaterial])),
  );
  const [selectedRoomId, setSelectedRoomId] = useState(rooms[0]?.id);

  // Rebuild only when the room set changes (a fresh generate_3d_shell call).
  // Color/material edits mutate the existing scene instead of rebuilding it.
  useEffect(() => {
    if (!containerRef.current || rooms.length === 0) return;
    const handle = buildHouseScene(containerRef.current, rooms, {
      wallColorHex,
      floorMaterials,
    });
    sceneRef.current = handle;
    return () => handle.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms]);

  function handleWallColorChange(hex: string) {
    setWallColorHex(hex);
    sceneRef.current?.setWallColor(hex);
    // This only updates the live view. To persist the edit through the
    // model (so it survives a re-render / another tool call), call the
    // edit_material tool here once free-text -> target/value parsing is
    // wired up — see README, edit_material row.
  }

  function handleFloorMaterialChange(roomId: string, material: FloorMaterial) {
    setFloorMaterials((prev) => ({ ...prev, [roomId]: material }));
    sceneRef.current?.setFloorMaterial(roomId, material);
  }

  if (rooms.length === 0) {
    return <div>No house model yet — call generate_3d_shell first.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        ref={containerRef}
        style={{ width: '100%', height: 480, borderRadius: 8, overflow: 'hidden' }}
      />

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
          Wall color
          <input
            type="color"
            value={wallColorHex}
            onChange={(e) => handleWallColorChange(e.target.value)}
          />
        </label>

        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
          Room
          <select value={selectedRoomId} onChange={(e) => setSelectedRoomId(e.target.value)}>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>

        <div style={{ display: 'flex', gap: 6 }}>
          {MATERIAL_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => selectedRoomId && handleFloorMaterialChange(selectedRoomId, opt.key)}
              style={{
                fontSize: 12,
                padding: '4px 8px',
                border:
                  floorMaterials[selectedRoomId ?? ''] === opt.key
                    ? '2px solid #333'
                    : '1px solid #ccc',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {typedProps.costEstimate && (
        <div style={{ fontSize: 13, color: '#555' }}>
          Estimated cost: ₹{typedProps.costEstimate.minInr.toLocaleString('en-IN')} – ₹
          {typedProps.costEstimate.maxInr.toLocaleString('en-IN')} for{' '}
          {typedProps.costEstimate.areaSqft.toLocaleString('en-IN')} sqft ({typedProps.costEstimate.rateTier})
        </div>
      )}
    </div>
  );
}
