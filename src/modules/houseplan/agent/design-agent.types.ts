// src/modules/houseplan/agent/design-agent.types.ts

/**
 * Types for the design agent — the AI layer that converts
 * natural language prompts into structured house modifications.
 */

/** A single modification command parsed from the user's prompt. */
export interface DesignCommand {
  /** Which room to target. Use "all" to apply to every room. */
  roomId: string;
  /** Which surface property to change. */
  target: 'wall_color' | 'wall_texture' | 'floor_material';
  /** The material ID from the catalog (e.g. "sage_green", "oak_hardwood"). */
  materialId: string;
}

/** The raw JSON structure the LLM is instructed to return. */
export interface LLMParsedResponse {
  commands: DesignCommand[];
  /** A short, friendly summary of what was changed (shown to the client). */
  summary: string;
}

/** What the design agent returns after processing a prompt. */
export interface AgentResult {
  /** Whether the agent successfully parsed and applied changes. */
  success: boolean;
  /** Commands that were applied. */
  commands: DesignCommand[];
  /** Human-readable summary of changes. */
  summary: string;
  /** Error message if parsing/application failed. */
  error?: string;
}
