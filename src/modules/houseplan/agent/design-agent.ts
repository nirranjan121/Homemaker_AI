// src/modules/houseplan/agent/design-agent.ts

import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildSystemPrompt, buildUserMessage } from './design-agent.prompts.js';
import { lookupMaterial } from '../materials/material-catalog.js';
import { HouseplanState } from '../houseplan.state.js';
import type { DesignCommand, LLMParsedResponse, AgentResult } from './design-agent.types.js';

/**
 * The Design Agent — takes a raw natural language prompt from the client,
 * sends it to Gemini with the house context, parses the structured response,
 * validates it against the material catalog, and applies the changes to the
 * house model.
 */
export class DesignAgent {
  private genAI: GoogleGenerativeAI | null = null;

  constructor(private readonly state: HouseplanState) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
  }

  /**
   * Process a natural language design prompt.
   * Returns the commands applied + a human-readable summary.
   */
  async processPrompt(prompt: string): Promise<AgentResult> {
    const model = this.state.get(); // throws if no house model yet

    // ── Try LLM parsing first ─────────────────────────────────────
    if (this.genAI) {
      try {
        return await this.processWithGemini(prompt);
      } catch (err) {
        console.error('Gemini call failed, falling back to rule-based parser:', err);
        // Fall through to rule-based
      }
    }

    // ── Fallback: rule-based parsing (works without API key) ──────
    return this.processWithRules(prompt);
  }

  // ================================================================
  // Gemini-powered parsing
  // ================================================================
  private async processWithGemini(prompt: string): Promise<AgentResult> {
    const model = this.state.get();
    const systemPrompt = buildSystemPrompt(model.rooms);
    const userMessage = buildUserMessage(prompt);

    const geminiModel = this.genAI!.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.1,       // Low creativity — we want deterministic parsing
        maxOutputTokens: 1024,
      },
    });

    const result = await geminiModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
    });

    const responseText = result.response.text().trim();

    // Parse the JSON response from Gemini
    let parsed: LLMParsedResponse;
    try {
      // Strip markdown code fences if Gemini wraps them anyway
      const cleaned = responseText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '');
      parsed = JSON.parse(cleaned);
    } catch {
      return {
        success: false,
        commands: [],
        summary: '',
        error: `Failed to parse Gemini response as JSON: ${responseText.substring(0, 200)}`
      };
    }

    // Validate and apply commands
    return this.validateAndApply(parsed);
  }

  // ================================================================
  // Rule-based fallback parsing (no API key needed)
  // ================================================================
  private processWithRules(prompt: string): AgentResult {
    const model = this.state.get();
    const lower = prompt.toLowerCase().trim();
    const commands: DesignCommand[] = [];

    // ── Detect target room ────────────────────────────────────────
    let targetRoomId = 'all';
    for (const room of model.rooms) {
      if (lower.includes(room.name.toLowerCase()) || lower.includes(room.id.toLowerCase())) {
        targetRoomId = room.id;
        break;
      }
    }

    // ── Detect wall color changes ─────────────────────────────────
    const colorKeywords: Record<string, string> = {
      'white': 'white', 'off white': 'off_white', 'cream': 'cream',
      'ivory': 'ivory', 'beige': 'beige', 'gray': 'light_gray', 'grey': 'light_gray',
      'charcoal': 'charcoal', 'black': 'black',
      'sage green': 'sage_green', 'sage': 'sage_green',
      'olive': 'olive_green', 'forest green': 'forest_green', 'green': 'sage_green',
      'mint': 'mint_green', 'sky blue': 'sky_blue', 'light blue': 'light_blue',
      'blue': 'sky_blue', 'navy': 'navy', 'teal': 'teal',
      'pink': 'blush_pink', 'dusty rose': 'dusty_rose', 'rose': 'dusty_rose',
      'terracotta': 'terracotta', 'orange': 'burnt_orange',
      'yellow': 'mustard_yellow', 'mustard': 'mustard_yellow',
      'lavender': 'lavender', 'purple': 'lavender', 'mauve': 'mauve',
      'taupe': 'taupe', 'sand': 'sand', 'peach': 'peach',
      'coral': 'coral', 'burgundy': 'burgundy', 'red': 'coral',
      'warm white': 'warm_white',
    };

    const isWallRelated = /\bwall(s)?\b/.test(lower) || /\bpaint\b/.test(lower) || /\bcolor\b/.test(lower) || /\bcolour\b/.test(lower);

    if (isWallRelated) {
      for (const [keyword, materialId] of Object.entries(colorKeywords)) {
        if (lower.includes(keyword)) {
          commands.push({ roomId: targetRoomId, target: 'wall_color', materialId });
          break;
        }
      }
    }

    // ── Detect wall texture changes ───────────────────────────────
    const textureKeywords: Record<string, string> = {
      'red brick': 'red_brick', 'white brick': 'white_brick', 'exposed brick': 'exposed_brick',
      'brick': 'red_brick', 'stone': 'natural_stone', 'slate': 'slate_stone',
      'limestone': 'limestone', 'wood panel': 'wood_panel_light', 'wood paneling': 'wood_panel_light',
      'dark wood panel': 'wood_panel_dark', 'walnut panel': 'wood_panel_walnut',
      'concrete wall': 'raw_concrete', 'raw concrete': 'raw_concrete',
      'polished concrete': 'polished_concrete', 'plaster': 'smooth_plaster',
      'venetian plaster': 'venetian_plaster',
    };

    const isTextureRelated = /\btexture\b/.test(lower) || /\bbrick\b/.test(lower) ||
      /\bstone\b/.test(lower) || /\bpanel\b/.test(lower) || /\bplaster\b/.test(lower);

    if (isTextureRelated && commands.length === 0) {
      for (const [keyword, materialId] of Object.entries(textureKeywords)) {
        if (lower.includes(keyword)) {
          commands.push({ roomId: targetRoomId, target: 'wall_texture', materialId });
          break;
        }
      }
    }

    // ── Detect floor material changes ─────────────────────────────
    const floorKeywords: Record<string, string> = {
      'white marble': 'white_marble', 'carrara marble': 'carrara_marble',
      'black marble': 'black_marble', 'marble': 'white_marble',
      'black granite': 'black_granite', 'grey granite': 'grey_granite', 'granite': 'grey_granite',
      'ceramic': 'ceramic_white', 'porcelain': 'porcelain_white',
      'oak': 'oak_hardwood', 'walnut floor': 'walnut_hardwood', 'walnut wood': 'walnut_hardwood',
      'teak': 'teak_hardwood', 'maple': 'maple_hardwood', 'cherry': 'cherry_hardwood',
      'hardwood': 'oak_hardwood', 'wood floor': 'oak_hardwood', 'wooden floor': 'oak_hardwood',
      'bamboo': 'bamboo_floor', 'carpet': 'grey_carpet', 'grey carpet': 'grey_carpet',
      'beige carpet': 'beige_carpet', 'navy carpet': 'navy_carpet',
      'vinyl': 'vinyl_wood', 'concrete floor': 'polished_concrete_floor',
      'tiles': 'ceramic_white', 'tile': 'ceramic_white',
    };

    const isFloorRelated = /\bfloor\b/.test(lower) || /\btile(s)?\b/.test(lower) ||
      /\bflooring\b/.test(lower) || /\bmarble\b/.test(lower) || /\bgranite\b/.test(lower) ||
      /\bhardwood\b/.test(lower) || /\bcarpet\b/.test(lower);

    if (isFloorRelated) {
      for (const [keyword, materialId] of Object.entries(floorKeywords)) {
        if (lower.includes(keyword)) {
          commands.push({ roomId: targetRoomId, target: 'floor_material', materialId });
          break;
        }
      }
    }

    if (commands.length === 0) {
      return {
        success: false,
        commands: [],
        summary: 'I couldn\'t understand the design change you wanted. Try something like: ' +
          '"make the living room walls sage green" or "put marble tiles in the kitchen". ' +
          '(Tip: set GEMINI_API_KEY in .env for much better natural language understanding!)',
      };
    }

    // Apply the parsed commands
    const summary = commands.map(c => {
      const mat = lookupMaterial(c.materialId);
      const roomLabel = c.roomId === 'all' ? 'all rooms' : c.roomId.replace(/_/g, ' ');
      return `${mat?.displayName ?? c.materialId} applied to ${c.target.replace(/_/g, ' ')} in ${roomLabel}`;
    }).join('; ');

    return this.validateAndApply({ commands, summary });
  }

  // ================================================================
  // Shared validation + application
  // ================================================================
  private validateAndApply(parsed: LLMParsedResponse): AgentResult {
    const model = this.state.get();
    const validCommands: DesignCommand[] = [];
    const validRoomIds = new Set(model.rooms.map(r => r.id));

    for (const cmd of parsed.commands) {
      // Validate material exists in catalog
      const material = lookupMaterial(cmd.materialId);
      if (!material) {
        console.warn(`Unknown material ID "${cmd.materialId}" — skipping`);
        continue;
      }

      // Validate room target
      if (cmd.roomId !== 'all' && !validRoomIds.has(cmd.roomId)) {
        console.warn(`Unknown room ID "${cmd.roomId}" — applying to all rooms`);
        cmd.roomId = 'all';
      }

      // Validate target ↔ material category compatibility
      const validTargets: Record<string, string[]> = {
        'wall_color': ['wall_paint'],
        'wall_texture': ['wall_texture'],
        'floor_material': ['floor_material'],
      };
      if (!validTargets[cmd.target]?.includes(material.category)) {
        console.warn(`Material "${cmd.materialId}" (${material.category}) doesn't match target "${cmd.target}" — adjusting target`);
        // Auto-correct the target based on the material's actual category
        if (material.category === 'wall_paint') cmd.target = 'wall_color';
        else if (material.category === 'wall_texture') cmd.target = 'wall_texture';
        else if (material.category === 'floor_material') cmd.target = 'floor_material';
      }

      validCommands.push(cmd);
    }

    if (validCommands.length === 0) {
      return {
        success: false,
        commands: [],
        summary: parsed.summary || 'No valid changes could be applied.',
        error: 'All parsed commands had invalid materials or room targets.',
      };
    }

    // ── Apply to state ────────────────────────────────────────────
    // Save snapshot for undo
    model.history = model.history ?? [];
    model.history.push(JSON.parse(JSON.stringify(model.roomMaterials)));

    for (const cmd of validCommands) {
      const targetRooms = cmd.roomId === 'all'
        ? model.rooms.map(r => r.id)
        : [cmd.roomId];

      const material = lookupMaterial(cmd.materialId)!;

      for (const roomId of targetRooms) {
        if (!model.roomMaterials[roomId]) {
          model.roomMaterials[roomId] = {
            wallColor: '#f2f0ea',
            wallTexture: 'smooth_plaster',
            floorMaterial: 'raw_concrete_floor',
          };
        }

        switch (cmd.target) {
          case 'wall_color':
            model.roomMaterials[roomId].wallColor = material.colorHex;
            model.roomMaterials[roomId].wallColorId = material.id;
            break;
          case 'wall_texture':
            model.roomMaterials[roomId].wallTexture = material.id;
            model.roomMaterials[roomId].wallColor = material.colorHex;
            model.roomMaterials[roomId].wallColorId = material.id;
            break;
          case 'floor_material':
            model.roomMaterials[roomId].floorMaterial = material.id;
            model.roomMaterials[roomId].floorColor = material.colorHex;
            break;
        }
      }
    }

    this.state.set(model);

    return {
      success: true,
      commands: validCommands,
      summary: parsed.summary,
    };
  }
}
