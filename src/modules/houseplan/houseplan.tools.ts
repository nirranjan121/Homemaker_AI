// src/modules/houseplan/houseplan.tools.ts
import { ToolDecorator as Tool, Widget, z, ExecutionContext } from '@nitrostack/core';
import { HouseplanState, HouseModel } from './houseplan.state.js';
import { extractRoomsFromPlanImage, shoelaceAreaSqM } from './houseplan.vision.js';
import { resolveCityTier, getRateRangeInrPerSqft, QualityTier } from './houseplan.rates.js';

export class HouseplanTools {
  constructor(private readonly state: HouseplanState) {}

  // ---------------------------------------------------------------------
  // 1. generate_3d_shell
  // ---------------------------------------------------------------------
  @Tool({
    name: 'generate_3d_shell',
    description:
      'Extract rooms/walls from an uploaded 2D floor plan image and generate a basic ' +
      'extruded 3D shell (walls, floor, no furniture/MEP). Returns geometry + total area.',
    inputSchema: z.object({
      planImageBase64: z.string().describe('Base64-encoded floor plan image (PNG/JPG)'),
      floorHeightM: z.number().min(2).max(5).default(3).describe('Wall height in meters')
    })
  })
  @Widget('house-3d-viewer')
  async generateShell(
    input: { planImageBase64: string; floorHeightM: number },
    _ctx: ExecutionContext
  ) {
    const rooms = await extractRoomsFromPlanImage(input.planImageBase64);
    const totalFloorAreaSqM = rooms.reduce(
      (sum, r) => sum + shoelaceAreaSqM(r.polygon),
      0
    );

    const model: HouseModel = {
      planId: `plan_${Date.now()}`,
      rooms: rooms.map((r) => ({ ...r, wallHeightM: input.floorHeightM })),
      totalFloorAreaSqM,
      materials: {
        wallColor: '#f2f0ea',
        floorMaterial: 'concrete'
      }
    };

    this.state.set(model);

    return {
      planId: model.planId,
      roomCount: model.rooms.length,
      totalFloorAreaSqM: Math.round(totalFloorAreaSqM * 10) / 10,
      rooms: model.rooms.map((r) => ({ id: r.id, name: r.name })),
      // Widget reads this shape via getToolOutput() to draw the 3D scene.
      geometry: model.rooms,
      materials: model.materials
    };
  }

  // ---------------------------------------------------------------------
  // 2. edit_material
  // ---------------------------------------------------------------------
  @Tool({
    name: 'edit_material',
    description:
      "Change wall color or floor material via a natural language command, e.g. " +
      "\"make the living room walls sage green\" or \"change the floor to oak wood\". " +
      'Geometry is not modified — this only changes surface appearance.',
    inputSchema: z.object({
      command: z.string().describe('Natural language description of the desired change'),
      // Kept simple/deterministic for the MVP: caller (or an upstream LLM step)
      // resolves the command into a target + value. Swap for a real NLU/LLM
      // call here once the deterministic path is working end-to-end.
      target: z.enum(['wall', 'floor']).describe('Which surface to change'),
      value: z.string().describe('New color (hex or name) or material name')
    })
  })
  @Widget('house-3d-viewer')
  async editMaterial(
    input: { command: string; target: 'wall' | 'floor'; value: string },
    _ctx: ExecutionContext
  ) {
    const model = this.state.get();

    if (input.target === 'wall') {
      model.materials.wallColor = input.value;
    } else {
      model.materials.floorMaterial = input.value;
    }
    this.state.set(model);

    return {
      planId: model.planId,
      appliedCommand: input.command,
      materials: model.materials,
      geometry: model.rooms
    };
  }

  // ---------------------------------------------------------------------
  // 3. estimate_cost
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
