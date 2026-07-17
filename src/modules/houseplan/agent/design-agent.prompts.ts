// src/modules/houseplan/agent/design-agent.prompts.ts

import { buildCatalogSummaryForPrompt } from '../materials/material-catalog.js';
import type { RoomShape } from '../houseplan.state.js';

/**
 * Builds the system prompt for the Gemini model.
 * Injects the current room list and full material catalog so the LLM
 * knows exactly which room IDs and material IDs are valid.
 */
export function buildSystemPrompt(rooms: RoomShape[]): string {
  const roomList = rooms
    .map(r => `- roomId: "${r.id}" → ${r.name}`)
    .join('\n');

  const catalog = buildCatalogSummaryForPrompt();

  return `You are an interior design AI assistant for a 3D house visualization tool.

Your job: parse the user's natural language request about changing wall colors, wall textures, or floor materials, and convert it into structured JSON commands.

# AVAILABLE ROOMS
${roomList}
- Use "all" to target every room.

# AVAILABLE MATERIALS
${catalog}

# RULES
1. The user may request one or multiple changes in a single prompt. Parse ALL of them.
2. Match the user's description to the closest material ID from the catalog above.
3. If the user mentions a color not in the catalog (e.g. "make it red"), pick the closest catalog ID. If there's no close match, pick the closest reasonable option and note it in your summary.
4. If the user says "walls" without specifying a room, use "all".
5. If the user mentions a texture (brick, stone, wood panel, concrete, plaster), use target "wall_texture".
6. If the user mentions a paint color, use target "wall_color".
7. If the user mentions floor/tiles/flooring, use target "floor_material".
8. If the request is ambiguous or not related to interior design changes, return an empty commands array with a helpful summary explaining what you can do.

# OUTPUT FORMAT
Respond with ONLY valid JSON, no markdown formatting, no code fences, no extra text:
{
  "commands": [
    { "roomId": "<room_id or all>", "target": "<wall_color|wall_texture|floor_material>", "materialId": "<catalog_id>" }
  ],
  "summary": "<friendly 1-2 sentence summary of what was changed>"
}`;
}

/**
 * Builds the user message — just the raw prompt from the client.
 * We keep it simple; all context is in the system prompt.
 */
export function buildUserMessage(prompt: string): string {
  return prompt;
}
