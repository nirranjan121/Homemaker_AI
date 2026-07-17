import { ToolDecorator as Tool, Widget, z, ExecutionContext, ControllerDecorator } from '@nitrostack/core';
import { HouseplanState, HouseModel } from './houseplan.state.js';
import { runMcpPipeline, shoelaceAreaSqM } from './houseplan.vision.js';
import { resolveCityTier, getRateRangeInrPerSqft, QualityTier } from './houseplan.rates.js';
import { DesignAgent } from './agent/design-agent.js';
import { lookupMaterial } from './materials/material-catalog.js';
import fs from 'fs';
import path from 'path';

@ControllerDecorator()
export class HouseplanTools {
  private readonly designAgent: DesignAgent;

  constructor(private readonly state: HouseplanState) {
    this.designAgent = new DesignAgent(state);
  }

  // ---------------------------------------------------------------------
  // 1. generate_3d_shell
  // ---------------------------------------------------------------------
  @Tool({
    name: 'generate_3d_shell',
    description:
      'Extract rooms/walls from an uploaded 2D floor plan image and generate a basic ' +
      'extruded 3D shell. Provide either planImageBase64 or filePath.',
    inputSchema: z.object({
      planImageBase64: z.string().optional().describe('Base64-encoded floor plan image (PNG/JPG)'),
      filePath: z.string().optional().describe('Absolute or relative file path to the floor plan image'),
      floorHeightM: z.number().min(2).max(5).default(3).describe('Wall height in meters')
    })
  })
  @Widget('house-3d-viewer')
  async generateShell(
    input: { planImageBase64?: string; filePath?: string; floorHeightM: number },
    _ctx: ExecutionContext
  ) {
    let base64Image = input.planImageBase64 || '';
    if (!base64Image && input.filePath) {
      const trimmedPath = input.filePath.trim();
      let resolvedPath = trimmedPath;
      if (!fs.existsSync(resolvedPath)) {
        resolvedPath = path.resolve(process.cwd(), trimmedPath);
      }
      try {
        const fileBuffer = fs.readFileSync(resolvedPath);
        base64Image = fileBuffer.toString('base64');
      } catch (err) {
        throw new Error(`Failed to read file at ${trimmedPath} (resolved as ${resolvedPath}): ${err}`);
      }
    }
    if (!base64Image) {
      throw new Error('You must provide either planImageBase64 or filePath');
    }
    const pipelineResult = await runMcpPipeline(base64Image);
    const rooms = pipelineResult.rooms;
    const totalFloorAreaSqM = pipelineResult.totalFloorAreaSqM;
    const roomMaterials = pipelineResult.roomMaterials;

    const model: HouseModel = {
      planId: `plan_${Date.now()}`,
      rooms: rooms.map((r) => ({ ...r, wallHeightM: input.floorHeightM })),
      totalFloorAreaSqM,
      roomMaterials,
      materials: {
        wallColor: '#f2f0ea',
        floorMaterial: 'concrete'
      },
      history: [],
    };

    this.state.set(model);

    return {
      planId: model.planId,
      roomCount: model.rooms.length,
      totalFloorAreaSqM: Math.round(totalFloorAreaSqM * 10) / 10,
      rooms: model.rooms.map((r) => ({ id: r.id, name: r.name })),
      // Widget reads this shape via getToolOutput() to draw the 3D scene.
      geometry: model.rooms,
      materials: model.materials,
      roomMaterials: model.roomMaterials,
    };
  }



  // ---------------------------------------------------------------------
  // 3. design_modify (NEW — AI-powered agent)
  // ---------------------------------------------------------------------
  @Tool({
    name: 'design_modify',
    description:
      'AI-powered interior design agent. Takes a natural language prompt from the ' +
      'client and intelligently modifies the house — wall colors, wall textures, ' +
      'floor tiles/materials. Examples: "make the living room walls sage green", ' +
      '"put marble tiles in the kitchen", "change all walls to exposed brick", ' +
      '"oak hardwood floors in the bedroom and teal walls". ' +
      'Supports multiple changes in a single prompt.',
    inputSchema: z.object({
      prompt: z.string().describe(
        'Natural language description of the desired design changes. ' +
        'Can include multiple changes, room targeting, and material/color names.'
      )
    })
  })
  @Widget('house-3d-viewer')
  async designModify(
    input: { prompt: string },
    _ctx: ExecutionContext
  ) {
    const agentResult = await this.designAgent.processPrompt(input.prompt);
    const model = this.state.get();
    await syncStateToSpecFile(model);

    return {
      planId: model.planId,
      success: agentResult.success,
      summary: agentResult.summary,
      commandsApplied: agentResult.commands,
      error: agentResult.error,
      // Widget data for re-render
      geometry: model.rooms,
      materials: model.materials,
      roomMaterials: model.roomMaterials,
    };
  }

  // ---------------------------------------------------------------------
  // 4. design_undo
  // ---------------------------------------------------------------------
  @Tool({
    name: 'design_undo',
    description: 'Undo the last design_modify change, reverting to the previous material state.',
    inputSchema: z.object({})
  })
  @Widget('house-3d-viewer')
  async designUndo(_input: {}, _ctx: ExecutionContext) {
    const undone = this.state.undo();
    const model = this.state.get();
    await syncStateToSpecFile(model);

    return {
      planId: model.planId,
      undone,
      summary: undone ? 'Reverted to previous design state.' : 'Nothing to undo.',
      geometry: model.rooms,
      materials: model.materials,
      roomMaterials: model.roomMaterials,
    };
  }

  // ---------------------------------------------------------------------
  // 5. estimate_cost
  // ---------------------------------------------------------------------
  @Tool({
    name: 'estimate_cost',
    description:
      'Rough construction cost estimate from the extracted floor area, a location, ' +
      'and a quality tier. Returns a range, not a single number — this is a ' +
      'feasibility-stage estimate (±20-30%), not a BOQ.',
    inputSchema: z.object({
      location: z.string().describe('City or locality, e.g. "Bengaluru"'),
      quality: z.enum(['basic', 'standard', 'premium']).default('standard')
    })
  })
  @Widget('house-3d-viewer')
  async estimateCost(
    input: { location: string; quality: QualityTier },
    _ctx: ExecutionContext
  ) {
    const model = this.state.get();
    const totalAreaSqFt = model.totalFloorAreaSqM * 10.764;

    // NOTE: resolveCityTier is a stub string-match. Two real upgrades, either:
    //  (a) Google Maps Geocoding API to resolve arbitrary input -> city, or
    //  (b) a live web-search call ("construction cost per sq ft <city> 2026")
    //      to pull current rates instead of the static table below.
    const { city, tier } = resolveCityTier(input.location);
    const [lowRate, highRate] = getRateRangeInrPerSqft(tier, input.quality);

    const lowCost = Math.round(totalAreaSqFt * lowRate);
    const highCost = Math.round(totalAreaSqFt * highRate);

    model.location = { query: input.location, resolvedCity: city };
    this.state.set(model);

    return {
      planId: model.planId,
      totalAreaSqFt: Math.round(totalAreaSqFt),
      resolvedCity: city,
      cityTier: tier,
      quality: input.quality,
      estimateInrLow: lowCost,
      estimateInrHigh: highCost,
      disclaimer:
        'Rough feasibility-stage estimate (area x regional rate band), not a detailed BOQ. ±20-30% typical variance.'
    };
  }
}

async function syncStateToSpecFile(model: HouseModel) {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const specPath = path.resolve(process.cwd(), 'uploads/3d_model_spec.json');
    if (fs.existsSync(specPath)) {
      const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
      if (spec.rooms && model.roomMaterials) {
        for (const room of spec.rooms) {
          const roomId = room.name.toLowerCase().replace(/\s+/g, '_');
          const mat = model.roomMaterials[roomId];
          if (mat) {
            room.wall_paint_color_hex = mat.wallColor;
            if (!room.floor_material) {
              room.floor_material = {};
            }
            room.floor_material.type = mat.floorMaterial;
            if (mat.floorColor) {
              room.floor_material.color_hex = mat.floorColor;
            }
          }
        }
      }
      fs.writeFileSync(specPath, JSON.stringify(spec, null, 2), 'utf8');
      console.log(`Synced updated design state back to spec file at ${specPath}`);
    }
  } catch (err) {
    console.error('Failed to sync state to spec file:', err);
  }
}
