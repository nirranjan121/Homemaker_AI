"use client";

import React, { useEffect, useRef, useState } from 'react';
import { buildHouseScene, type SceneHandle } from './scene';
import { useWidgetSDK } from '@nitrostack/widgets';

// ── Local types ──

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
  /** Chatbot extensions */
  chatResponse?: string;
  chatHistory?: { role: 'user' | 'model' | 'assistant'; content: string }[];
}

export default function HouseViewer(props: HouseViewerProps) {
  // Use the widget SDK to get real-time tool output and call tools
  const sdkData = useWidgetSDK();
  const output = (sdkData.toolOutput || props) as HouseViewerProps;

  const rooms = output.geometry ?? output.rooms ?? [];
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneHandle | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [changeLog, setChangeLog] = useState<string[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'model' | 'assistant'; content: string }>>([
    { role: 'model', content: "Hello! I'm your HomeCraft design assistant. You can ask me questions about your plan, layout, materials, or estimated costs!" }
  ]);

  // ── Build/rebuild scene when rooms change ─────────────────────
  useEffect(() => {
    if (!containerRef.current || rooms.length === 0) return;

    const handle = buildHouseScene(containerRef.current, rooms, {
      wallColorHex: output.materials?.wallColor ?? output.wallColorHex,
      roomMaterials: output.roomMaterials,
    });
    sceneRef.current = handle;

    return () => handle.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms]);

  // ── Update materials live when roomMaterials change ───────────
  useEffect(() => {
    if (sceneRef.current && output.roomMaterials) {
      sceneRef.current.updateAllRoomMaterials(output.roomMaterials);
    }
  }, [output.roomMaterials]);

  // ── Log design_modify results ─────────────────────────────────
  useEffect(() => {
    if (output.summary) {
      setChangeLog(prev => [
        `${new Date().toLocaleTimeString()}: ${output.summary}`,
        ...prev.slice(0, 19), // keep last 20
      ]);
    }
  }, [output.summary]);

  // ── Handle Chat History updates from SDK/Props ──────────────────
  useEffect(() => {
    if (output.chatHistory && output.chatHistory.length > 0) {
      setMessages(output.chatHistory);
    }
  }, [output.chatHistory]);

  // ── Scroll to bottom of chat ────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isSending) return;

    const userQuestion = textToSend.trim();
    setInputText('');
    setIsSending(true);

    // Optimistically update chat history locally
    const currentHistory = [...messages, { role: 'user' as const, content: userQuestion }];
    setMessages(currentHistory);

    try {
      if (sdkData?.callTool) {
        // Strip the introductory greeting from history before sending to keep prompt clean
        const apiHistory = currentHistory[0]?.content.startsWith("Hello!")
          ? currentHistory.slice(1)
          : currentHistory;
        
        // Remove the last item (the question itself) as callTool takes it in the 'question' arg
        const historyContext = apiHistory.slice(0, -1);

        await sdkData.callTool('ask_chatbot', {
          question: userQuestion,
          chatHistory: historyContext
        });
      } else {
        // Standalone preview fallback mock answer
        setTimeout(() => {
          setMessages(prev => [
            ...prev,
            { 
              role: 'model', 
              content: `Mock Assistant Answer: You asked "${userQuestion}". (Running in standalone preview mode; connect to a live MCP client to use Gemini chatbot.)` 
            }
          ]);
          setIsSending(false);
        }, 1000);
      }
    } catch (err) {
      console.error('Failed to communicate with chatbot tool:', err);
      setMessages(prev => [
        ...prev,
        { role: 'model', content: 'Sorry, I encountered an error communicating with the backend chatbot.' }
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(inputText);
  };

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
      <div style={styles.mainLayout}>
        {/* ── Left Column: 3D View & Room Legend ───────────────── */}
        <div style={styles.leftColumn}>
          {/* 3D Viewport */}
          <div ref={containerRef} style={styles.viewport} />

          {/* Feedback Bar */}
          {output.summary && (
            <div
              style={{
                ...styles.feedbackBar,
                ...(output.success === false ? styles.feedbackError : styles.feedbackSuccess),
              }}
            >
              <span style={styles.feedbackIcon}>
                {output.success === false ? '⚠️' : '✨'}
              </span>
              <span>{output.summary}</span>
            </div>
          )}

          {output.error && (
            <div style={{ ...styles.feedbackBar, ...styles.feedbackError }}>
              <span style={styles.feedbackIcon}>❌</span>
              <span>{output.error}</span>
            </div>
          )}

          {/* Room Materials Legend */}
          {output.roomMaterials && (
            <div style={styles.legendContainer}>
              <div style={styles.legendTitle}>🎨 Applied Materials Legend</div>
              <div style={styles.materialsGrid}>
                {rooms.map(room => {
                  const rm = output.roomMaterials?.[room.id];
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
                        <span>Paint: {rm.wallColorId?.replace(/_/g, ' ') || 'default'}</span>
                        <span>Texture: {rm.wallTexture?.replace(/_/g, ' ') || 'flat'}</span>
                        <span>Floor: {rm.floorMaterial?.replace(/_/g, ' ') || 'concrete'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Cost Estimate Bar */}
          {output.costEstimate && (
            <div style={styles.costBar}>
              💰 Estimated cost: ₹{output.costEstimate.minInr.toLocaleString('en-IN')} – ₹
              {output.costEstimate.maxInr.toLocaleString('en-IN')} for{' '}
              {output.costEstimate.areaSqft.toLocaleString('en-IN')} sqft ({output.costEstimate.rateTier})
            </div>
          )}

          {/* Change Log */}
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

        {/* ── Right Column: Chatbot Sidebar ──────────────────── */}
        <div style={styles.chatSidebar}>
          {/* Chat Header */}
          <div style={styles.chatHeader}>
            <span style={styles.chatHeaderIcon}>💬</span>
            <div style={styles.chatHeaderInfo}>
              <div style={styles.chatTitle}>HomeCraft Assistant</div>
              <div style={styles.chatSubtitle}>Ask about layouts, materials or costs</div>
            </div>
          </div>

          {/* Message List */}
          <div style={styles.chatMessages}>
            {messages.map((msg, i) => (
              <div
                key={i}
                style={msg.role === 'user' ? styles.userBubbleContainer : styles.assistantBubbleContainer}
              >
                <div style={msg.role === 'user' ? styles.userBubble : styles.assistantBubble}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isSending && (
              <div style={styles.assistantBubbleContainer}>
                <div style={styles.typingBubble}>
                  <span style={styles.dot}>.</span>
                  <span style={styles.dot}>.</span>
                  <span style={styles.dot}>.</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick suggestions chips */}
          <div style={styles.suggestionChips}>
            <button
              type="button"
              style={styles.chipButton}
              onClick={() => handleSendMessage("What is the total floor area of the plan?")}
            >
              📏 Area Details
            </button>
            <button
              type="button"
              style={styles.chipButton}
              onClick={() => handleSendMessage("What rooms do we have in this house?")}
            >
              🚪 Room Layout
            </button>
            <button
              type="button"
              style={styles.chipButton}
              onClick={() => handleSendMessage("What are the current material selections?")}
            >
              🎨 Materials list
            </button>
            <button
              type="button"
              style={styles.chipButton}
              onClick={() => handleSendMessage("What is the typical cost band for standard quality in Mumbai?")}
            >
              💰 Cost Guide
            </button>
          </div>

          {/* Input Area */}
          <form onSubmit={handleFormSubmit} style={styles.chatInputForm}>
            <input
              type="text"
              placeholder="Ask a doubt about layout or costs..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              style={styles.chatInput}
            />
            <button type="submit" disabled={isSending} style={styles.chatSendBtn}>
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Styles (Rich, Premium Glassmorphism Theme) ───────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    fontFamily: "'Outfit', 'Inter', 'Segoe UI', system-ui, sans-serif",
    color: '#2d3748',
  },
  mainLayout: {
    display: 'flex',
    flexDirection: 'row',
    gap: 20,
    width: '100%',
    flexWrap: 'wrap' as const,
  },
  leftColumn: {
    flex: '2 1 500px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  viewport: {
    width: '100%',
    height: 460,
    borderRadius: 16,
    overflow: 'hidden',
    border: '1px solid #e2e8f0',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: 350,
    gap: 12,
    color: '#718096',
    border: '2px dashed #cbd5e0',
    borderRadius: 16,
    padding: 24,
    textAlign: 'center' as const,
  },
  emptyIcon: { fontSize: 56 },
  emptyText: { fontSize: 20, fontWeight: 700, color: '#4a5568' },
  emptySubtext: { fontSize: 14, color: '#a0aec0' },

  // Legend
  legendContainer: {
    backgroundColor: '#f7fafc',
    border: '1px solid #edf2f7',
    borderRadius: 12,
    padding: 14,
  },
  legendTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: '#4a5568',
    marginBottom: 10,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  materialsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: 10,
  },
  roomCard: {
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #e2e8f0',
    backgroundColor: '#ffffff',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)',
  },
  roomCardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  colorSwatch: {
    width: 14,
    height: 14,
    borderRadius: 3,
    border: '1px solid #cbd5e0',
    flexShrink: 0,
  },
  roomName: {
    fontSize: 13,
    fontWeight: 600,
    color: '#1a202c',
  },
  roomCardDetails: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
    fontSize: 11,
    color: '#718096',
    textTransform: 'capitalize' as const,
  },

  // Feedback & Costs
  feedbackBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 16px',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 500,
  },
  feedbackSuccess: {
    backgroundColor: '#f0fdf4',
    color: '#166534',
    border: '1px solid #bbf7d0',
  },
  feedbackError: {
    backgroundColor: '#fff7ed',
    color: '#9a3412',
    border: '1px solid #fed7aa',
  },
  feedbackIcon: { fontSize: 16 },
  costBar: {
    fontSize: 13,
    fontWeight: 600,
    color: '#1a202c',
    padding: '12px 16px',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    border: '1px solid #e2e8f0',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)',
  },

  // Log Section
  logSection: {
    fontSize: 12,
    color: '#718096',
  },
  logSummary: {
    cursor: 'pointer',
    fontWeight: 600,
    padding: '4px 0',
  },
  logList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
    padding: '8px 0',
    maxHeight: 120,
    overflowY: 'auto' as const,
  },
  logEntry: {
    padding: '3px 10px',
    fontSize: 11,
    color: '#4a5568',
    borderLeft: '3px solid #cbd5e0',
  },

  // ── Chatbot Sidebar ────────────────────────────────────────────────
  chatSidebar: {
    flex: '1 1 300px',
    minWidth: 300,
    height: 580,
    display: 'flex',
    flexDirection: 'column' as const,
    border: '1px solid #e2e8f0',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    boxShadow: '0 10px 25px rgba(0,0,0,0.04)',
  },
  chatHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '16px 20px',
    borderBottom: '1px solid #f1f5f9',
    backgroundColor: '#f8fafc',
  },
  chatHeaderIcon: {
    fontSize: 24,
  },
  chatHeaderInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  chatTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: '#0f172a',
  },
  chatSubtitle: {
    fontSize: 11,
    color: '#64748b',
  },
  chatMessages: {
    flex: 1,
    padding: '20px 16px',
    overflowY: 'auto' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
    backgroundColor: '#fdfdfd',
  },
  userBubbleContainer: {
    display: 'flex',
    justifyContent: 'flex-end',
    width: '100%',
  },
  userBubble: {
    maxWidth: '85%',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    padding: '10px 14px',
    borderRadius: '16px 16px 2px 16px',
    fontSize: 13,
    lineHeight: 1.4,
    boxShadow: '0 2px 8px rgba(59, 130, 246, 0.15)',
  },
  assistantBubbleContainer: {
    display: 'flex',
    justifyContent: 'flex-start',
    width: '100%',
  },
  assistantBubble: {
    maxWidth: '85%',
    backgroundColor: '#f1f5f9',
    color: '#334155',
    padding: '10px 14px',
    borderRadius: '16px 16px 16px 2px',
    fontSize: 13,
    lineHeight: 1.4,
    whiteSpace: 'pre-wrap' as const,
  },
  typingBubble: {
    backgroundColor: '#f1f5f9',
    padding: '10px 16px',
    borderRadius: '16px 16px 16px 2px',
    display: 'inline-flex',
    gap: 3,
  },
  dot: {
    fontWeight: 800,
    color: '#64748b',
    fontSize: 16,
    animation: 'pulse 1s infinite',
  },
  suggestionChips: {
    display: 'flex',
    gap: 6,
    padding: '8px 12px',
    overflowX: 'auto' as const,
    borderTop: '1px solid #f1f5f9',
    backgroundColor: '#f8fafc',
    whiteSpace: 'nowrap' as const,
  },
  chipButton: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '20px',
    padding: '5px 12px',
    fontSize: 11,
    fontWeight: 600,
    color: '#475569',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    outline: 'none',
  },
  chatInputForm: {
    display: 'flex',
    padding: 12,
    gap: 8,
    borderTop: '1px solid #f1f5f9',
    backgroundColor: '#ffffff',
  },
  chatInput: {
    flex: 1,
    border: '1px solid #e2e8f0',
    borderRadius: 24,
    padding: '10px 16px',
    fontSize: 13,
    outline: 'none',
    transition: 'border-color 0.15s ease',
  },
  chatSendBtn: {
    backgroundColor: '#0f172a',
    color: '#ffffff',
    border: 'none',
    borderRadius: 24,
    padding: '0 18px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
  },
};
