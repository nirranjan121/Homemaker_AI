"use client";

import React, { useEffect, useRef, useState } from 'react';
import { buildHouseScene, type SceneHandle } from './scene';

// ── Local types (mirroring server types without import path issues) ──

interface RoomShape {
  id: string;
  name: string;
  polygon: { x: number; y: number }[];
  wallHeightM: number;
}

interface RoomMaterials {
  wallColor: string;
  wallColorId?: string;
  wallTexture: string;
  floorMaterial: string;
  floorColor?: string;
}

interface DesignCommand {
  roomId: string;
  target: 'wall_color' | 'wall_texture' | 'floor_material';
  materialId: string;
}

// NOTE ON WIRING: this assumes @nitrostack/widgets passes the tool's
// return value straight through as this component's props (that's the
// pattern shown for @Widget-decorated tools/resources in the NitroStack
// docs). Check your installed @nitrostack/widgets version's guide — if it
// instead exposes props via a hook (e.g. useToolOutput()) rather than
// direct props, swap accordingly.
export interface HouseViewerProps {
  rooms?: RoomShape[];
  geometry?: RoomShape[];
  wallColorHex?: string;
  roomMaterials?: Record<string, RoomMaterials>;
  /** Legacy flat materials from older tools */
  materials?: { wallColor: string; floorMaterial: string };
  /** design_modify results */
  success?: boolean;
  summary?: string;
  commandsApplied?: DesignCommand[];
  error?: string;
  /** estimate_cost results */
  costEstimate?: {
    areaSqft: number;
    minInr: number;
    maxInr: number;
    rateTier: string;
  } | null;
}

export default function HouseViewer(props: HouseViewerProps) {
  const rooms = props.geometry ?? props.rooms ?? [];
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneHandle | null>(null);
  const [changeLog, setChangeLog] = useState<string[]>([]);

  // ── Build/rebuild scene when rooms change ─────────────────────
  useEffect(() => {
    if (!containerRef.current || rooms.length === 0) return;

    const handle = buildHouseScene(containerRef.current, rooms, {
      wallColorHex: props.materials?.wallColor ?? props.wallColorHex,
      roomMaterials: props.roomMaterials,
    });
    sceneRef.current = handle;

    return () => handle.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms]);

  // ── Update materials live when roomMaterials change ───────────
  useEffect(() => {
    if (sceneRef.current && props.roomMaterials) {
      sceneRef.current.updateAllRoomMaterials(props.roomMaterials);
    }
  }, [props.roomMaterials]);

  // ── Log design_modify results ─────────────────────────────────
  useEffect(() => {
    if (props.summary) {
      setChangeLog(prev => [
        `${new Date().toLocaleTimeString()}: ${props.summary}`,
        ...prev.slice(0, 19), // keep last 20
      ]);
    }
  }, [props.summary]);

  if (rooms.length === 0) {
    return (
      <div style={styles.emptyState}>
        <div style={styles.emptyIcon}>🏠</div>
        <div style={styles.emptyText}>No house model yet</div>
        <div style={styles.emptySubtext}>
          Call <code>generate_3d_shell</code> with a floor plan image to get started.
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* ── 3D Viewport ──────────────────────────────────────── */}
      <div ref={containerRef} style={styles.viewport} />

      {/* ── Agent Feedback Bar ───────────────────────────────── */}
      {props.summary && (
        <div
          style={{
            ...styles.feedbackBar,
            ...(props.success === false ? styles.feedbackError : styles.feedbackSuccess),
          }}
        >
          <span style={styles.feedbackIcon}>
            {props.success === false ? '⚠️' : '✨'}
          </span>
          <span>{props.summary}</span>
        </div>
      )}

      {props.error && (
        <div style={{ ...styles.feedbackBar, ...styles.feedbackError }}>
          <span style={styles.feedbackIcon}>❌</span>
          <span>{props.error}</span>
        </div>
      )}

      {/* ── Room Materials Legend ─────────────────────────────── */}
      {props.roomMaterials && (
        <div style={styles.materialsGrid}>
          {rooms.map(room => {
            const rm = props.roomMaterials?.[room.id];
            if (!rm) return null;
            return (
              <div key={room.id} style={styles.roomCard}>
                <div style={styles.roomCardHeader}>
                  <div
                    style={{
                      ...styles.colorSwatch,
                      backgroundColor: rm.wallColor,
                    }}
                  />
                  <span style={styles.roomName}>{room.name}</span>
                </div>
                <div style={styles.roomCardDetails}>
                  <span>Wall: {rm.wallColorId?.replace(/_/g, ' ') || 'default'}</span>
                  <span>Texture: {rm.wallTexture?.replace(/_/g, ' ') || 'flat'}</span>
                  <span>Floor: {rm.floorMaterial?.replace(/_/g, ' ') || 'concrete'}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Commands Applied (from design_modify) ──────────── */}
      {props.commandsApplied && props.commandsApplied.length > 0 && (
        <div style={styles.commandsSection}>
          <div style={styles.commandsTitle}>Changes applied:</div>
          {props.commandsApplied.map((cmd, i) => (
            <div key={i} style={styles.commandTag}>
              <span style={styles.commandTarget}>
                {cmd.target.replace(/_/g, ' ')}
              </span>
              <span style={styles.commandArrow}>→</span>
              <span style={styles.commandValue}>
                {cmd.materialId.replace(/_/g, ' ')}
              </span>
              <span style={styles.commandRoom}>
                ({cmd.roomId === 'all' ? 'all rooms' : cmd.roomId.replace(/_/g, ' ')})
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Cost Estimate ────────────────────────────────────── */}
      {props.costEstimate && (
        <div style={styles.costBar}>
          💰 Estimated cost: ₹{props.costEstimate.minInr.toLocaleString('en-IN')} – ₹
          {props.costEstimate.maxInr.toLocaleString('en-IN')} for{' '}
          {props.costEstimate.areaSqft.toLocaleString('en-IN')} sqft ({props.costEstimate.rateTier})
        </div>
      )}

      {/* ── Change Log ───────────────────────────────────────── */}
      {changeLog.length > 0 && (
        <details style={styles.logSection}>
          <summary style={styles.logSummary}>
            📋 Change history ({changeLog.length})
          </summary>
          <div style={styles.logList}>
            {changeLog.map((entry, i) => (
              <div key={i} style={styles.logEntry}>{entry}</div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
  },
  viewport: {
    width: '100%',
    height: 480,
    borderRadius: 12,
    overflow: 'hidden',
    border: '1px solid #e0ddd8',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: 300,
    gap: 8,
    color: '#888',
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 18, fontWeight: 600, color: '#555' },
  emptySubtext: { fontSize: 13, color: '#999' },

  // Feedback bar
  feedbackBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
  },
  feedbackSuccess: {
    backgroundColor: '#e8f5e9',
    color: '#2e7d32',
    border: '1px solid #c8e6c9',
  },
  feedbackError: {
    backgroundColor: '#fff3e0',
    color: '#e65100',
    border: '1px solid #ffe0b2',
  },
  feedbackIcon: { fontSize: 16 },

  // Materials grid
  materialsGrid: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap' as const,
  },
  roomCard: {
    flex: '1 1 180px',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #e8e5e0',
    backgroundColor: '#fafaf8',
  },
  roomCardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  colorSwatch: {
    width: 16,
    height: 16,
    borderRadius: 4,
    border: '1px solid #ccc',
    flexShrink: 0,
  },
  roomName: {
    fontSize: 13,
    fontWeight: 600,
    color: '#333',
  },
  roomCardDetails: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
    fontSize: 11,
    color: '#777',
    textTransform: 'capitalize' as const,
  },

  // Commands
  commandsSection: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 6,
    alignItems: 'center',
  },
  commandsTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: '#555',
    marginRight: 4,
  },
  commandTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 10px',
    borderRadius: 20,
    backgroundColor: '#f0eee8',
    fontSize: 11,
  },
  commandTarget: { fontWeight: 600, color: '#555', textTransform: 'capitalize' as const },
  commandArrow: { color: '#aaa' },
  commandValue: { color: '#2e7d32', textTransform: 'capitalize' as const },
  commandRoom: { color: '#999', fontStyle: 'italic' as const },

  // Cost
  costBar: {
    fontSize: 13,
    color: '#555',
    padding: '8px 12px',
    backgroundColor: '#f5f3ee',
    borderRadius: 8,
    border: '1px solid #e8e5e0',
  },

  // Change log
  logSection: {
    fontSize: 12,
    color: '#666',
  },
  logSummary: {
    cursor: 'pointer',
    fontWeight: 500,
    padding: '4px 0',
  },
  logList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
    padding: '6px 0',
    maxHeight: 150,
    overflowY: 'auto' as const,
  },
  logEntry: {
    padding: '2px 8px',
    fontSize: 11,
    color: '#888',
    borderLeft: '2px solid #e0ddd8',
  },
};
