// src/modules/costestimator/costestimator.tools.ts

import {
  ToolDecorator as Tool,
  z,
  ExecutionContext,
  ControllerDecorator,
} from '@nitrostack/core';
import { CostEstimatorState } from './costestimator.state.js';
import { GeocoderService } from './costestimator.geocoder.js';
import { WebSearchService } from './costestimator.web-search.js';
import { estimateMaterials, totalMaterialCost } from './costestimator.materials.js';
import type { CostEstimateResult, QualityTier } from './costestimator.types.js';
import { HouseplanState } from '../houseplan/houseplan.state.js';

const SQFT_PER_SQM = 10.764;

/** Format a large INR number as a human-readable crore/lakh string. */
function formatInr(amount: number): string {
  if (amount >= 1_00_00_000) {
    return `₹${(amount / 1_00_00_000).toFixed(2)} Cr`;
  }
  if (amount >= 1_00_000) {
    return `₹${(amount / 1_00_000).toFixed(2)} L`;
  }
  return `₹${amount.toLocaleString('en-IN')}`;
}

@ControllerDecorator()
export class CostEstimatorTools {
  constructor(
    private readonly state: CostEstimatorState,
    private readonly houseplanState: HouseplanState,
    private readonly geocoder: GeocoderService,
    private readonly webSearch: WebSearchService
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Tool 1: estimate_full_cost
  // ─────────────────────────────────────────────────────────────────────────
  @Tool({
    name: 'estimate_full_cost',
    description:
      'Compute a detailed, internet-sourced construction + land + material cost estimate. ' +
      'Automatically reads the house floor area from the active 3D model (if generate_3d_shell ' +
      'was called) or accepts a manual area. Fetches live construction rates, land prices, and ' +
      'material commodity prices from the web using Gemini grounded search — results are ' +
      'current, not hardcoded. Returns an itemised breakdown with source citations.',
    inputSchema: z.object({
      location: z
        .string()
        .describe(
          'Location for the house, e.g. "Whitefield, Bengaluru" or "Andheri West, Mumbai". ' +
          'Be as specific as possible for more accurate rates.'
        ),
      quality: z
        .enum(['basic', 'standard', 'premium'])
        .default('standard')
        .describe(
          'Construction quality tier: basic (economy finishes), ' +
          'standard (mid-range), premium (high-end materials).'
        ),
      floors: z
        .number()
        .int()
        .min(1)
        .max(10)
        .default(1)
        .describe('Number of floors / storeys to build.'),
      houseAreaSqFt: z
        .number()
        .positive()
        .optional()
        .describe(
          'Total built-up area in sq ft. If omitted, the area is read from the active ' +
          '3D floor plan model (generate_3d_shell must have been called first).'
        ),
      plotAreaSqYd: z
        .number()
        .positive()
        .optional()
        .describe(
          'Plot / land area in square yards. Provide this to include a land cost estimate. ' +
          'If omitted, land cost is not calculated.'
        ),
    }),
  })
  async estimateFullCost(
    input: {
      location: string;
      quality: QualityTier;
      floors: number;
      houseAreaSqFt?: number;
      plotAreaSqYd?: number;
    },
    _ctx: ExecutionContext
  ): Promise<CostEstimateResult & { summary: string }> {
    // ── 1. Resolve house area ────────────────────────────────────────────────
    let houseAreaSqFt = input.houseAreaSqFt;
    let planId: string | undefined;

    if (!houseAreaSqFt) {
      if (this.houseplanState.has()) {
        const model = this.houseplanState.get();
        houseAreaSqFt = model.totalFloorAreaSqM * SQFT_PER_SQM * input.floors;
        planId = model.planId;
      } else {
        throw new Error(
          'No floor area provided and no active house plan found. ' +
          'Either call generate_3d_shell with a floor plan image first, ' +
          'or provide houseAreaSqFt manually.'
        );
      }
    }

    // ── 2. Geocode location ──────────────────────────────────────────────────
    let locationInfo = this.state.locationMatches(input.location)
      ? this.state.getLocation()!
      : await this.geocoder.geocode(input.location);

    this.state.setLocation(locationInfo);

    // ── 3. Fetch live rates (with TTL cache) ─────────────────────────────────
    let liveRates = this.state.getRatesIfFresh();
    if (!liveRates) {
      liveRates = await this.webSearch.fetchLiveRates(
        locationInfo.city,
        locationInfo.locality,
        input.quality
      );
      this.state.setRates(liveRates);
    }

    // ── 4. Compute construction cost ─────────────────────────────────────────
    const totalAreaForConstruction = houseAreaSqFt * input.floors;
    const { low: cLow, high: cHigh, mid: cMid } = liveRates.constructionRateInrPerSqft;

    const constructionCost = {
      low: Math.round(totalAreaForConstruction * cLow),
      high: Math.round(totalAreaForConstruction * cHigh),
      mid: Math.round(totalAreaForConstruction * cMid),
    };

    // ── 5. Compute land cost (optional) ──────────────────────────────────────
    let landCost: { low: number; high: number; mid: number } | undefined;
    if (input.plotAreaSqYd && liveRates.landRateInrPerSqYd) {
      const { low: lLow, high: lHigh, mid: lMid } = liveRates.landRateInrPerSqYd;
      landCost = {
        low: Math.round(input.plotAreaSqYd * lLow),
        high: Math.round(input.plotAreaSqYd * lHigh),
        mid: Math.round(input.plotAreaSqYd * lMid),
      };
    }

    // ── 6. Material breakdown ────────────────────────────────────────────────
    const materialBreakdown = estimateMaterials(
      totalAreaForConstruction,
      input.floors,
      input.quality,
      liveRates.materialPrices
    );
    const matTotal = totalMaterialCost(materialBreakdown);

    // ── 7. Total project cost ─────────────────────────────────────────────────
    const totalProjectCost = {
      low: constructionCost.low + (landCost?.low ?? 0),
      high: constructionCost.high + (landCost?.high ?? 0),
    };

    // ── 8. Build result ───────────────────────────────────────────────────────
    const estimate: CostEstimateResult = {
      planId,
      location: locationInfo,
      inputs: {
        houseAreaSqFt: Math.round(totalAreaForConstruction),
        floors: input.floors,
        plotAreaSqYd: input.plotAreaSqYd,
        quality: input.quality,
        currency: 'INR',
      },
      constructionCost,
      landCost,
      materialBreakdown,
      totalMaterialCost: matTotal,
      totalProjectCost,
      rates: liveRates,
      disclaimer:
        'Feasibility-stage estimate based on live internet data. ' +
        'Construction costs include labour + materials (±20-30% variance). ' +
        'Land rates are indicative market averages. ' +
        'Engage a structural engineer and quantity surveyor for a formal BOQ before procurement.',
      fetchedAt: liveRates.fetchedAt,
    };

    this.state.setEstimate(estimate);

    // ── 9. Build a human-readable summary ────────────────────────────────────
    const locationLabel = locationInfo.locality
      ? `${locationInfo.locality}, ${locationInfo.city}`
      : locationInfo.city;

    const summaryParts = [
      `📍 **Location**: ${locationLabel} (${locationInfo.tier} market)`,
      `🏠 **House Area**: ${Math.round(totalAreaForConstruction).toLocaleString('en-IN')} sq ft, ${input.floors} floor(s), ${input.quality} quality`,
      `🔨 **Construction Cost**: ${formatInr(constructionCost.low)} – ${formatInr(constructionCost.high)}`,
    ];

    if (landCost) {
      summaryParts.push(
        `🌍 **Land Cost** (${input.plotAreaSqYd} sq yd): ${formatInr(landCost.low)} – ${formatInr(landCost.high)}`
      );
    }

    summaryParts.push(
      `🧱 **Material Cost Estimate**: ${formatInr(matTotal)}`,
      `💰 **Total Project Cost**: ${formatInr(totalProjectCost.low)} – ${formatInr(totalProjectCost.high)}`,
      `📊 **Live Rate Used**: ₹${cLow}–₹${cHigh}/sq ft (construction) — fetched ${new Date(liveRates.fetchedAt).toLocaleTimeString('en-IN')}`
    );

    if (liveRates.sources.length > 0) {
      summaryParts.push(
        `🔗 **Sources**: ${liveRates.sources.slice(0, 3).join(', ')}`
      );
    }

    return { ...estimate, summary: summaryParts.join('\n') };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Tool 2: refine_cost_estimate
  // ─────────────────────────────────────────────────────────────────────────
  @Tool({
    name: 'refine_cost_estimate',
    description:
      'Adjust an existing cost estimate by changing one or more parameters ' +
      '(quality tier, number of floors, plot area, or location). ' +
      'Re-uses cached geocode and rates where possible to avoid repeat API calls. ' +
      'Call estimate_full_cost first before using this tool.',
    inputSchema: z.object({
      quality: z
        .enum(['basic', 'standard', 'premium'])
        .optional()
        .describe('New quality tier. Omit to keep existing.'),
      floors: z
        .number()
        .int()
        .min(1)
        .max(10)
        .optional()
        .describe('New number of floors. Omit to keep existing.'),
      plotAreaSqYd: z
        .number()
        .positive()
        .optional()
        .describe('New plot area in sq yards. Omit to keep existing.'),
      location: z
        .string()
        .optional()
        .describe('New location. Omit to keep existing. Will trigger fresh rate fetch.'),
    }),
  })
  async refineCostEstimate(
    input: {
      quality?: QualityTier;
      floors?: number;
      plotAreaSqYd?: number;
      location?: string;
    },
    ctx: ExecutionContext
  ): Promise<CostEstimateResult & { summary: string }> {
    const existing = this.state.getEstimate();
    if (!existing) {
      throw new Error(
        'No existing estimate to refine. Call estimate_full_cost first.'
      );
    }

    // If location changed, clear the rate cache so fresh rates are fetched
    if (input.location && input.location.toLowerCase() !== existing.location.query.toLowerCase()) {
      this.state.clearRates();
    }

    // Merge new inputs with existing
    return this.estimateFullCost(
      {
        location: input.location ?? existing.location.query,
        quality: input.quality ?? existing.inputs.quality,
        floors: input.floors ?? existing.inputs.floors,
        houseAreaSqFt: existing.inputs.houseAreaSqFt / existing.inputs.floors,
        plotAreaSqYd: input.plotAreaSqYd ?? existing.inputs.plotAreaSqYd,
      },
      ctx
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Tool 3: get_material_breakdown
  // ─────────────────────────────────────────────────────────────────────────
  @Tool({
    name: 'get_material_breakdown',
    description:
      'Return the detailed itemised material breakdown from the most recent cost estimate. ' +
      'Shows quantities and current market prices for cement, steel, sand, aggregate, ' +
      'bricks, paint, and tiles. Call estimate_full_cost first.',
    inputSchema: z.object({}),
  })
  getMaterialBreakdown(
    _input: {},
    _ctx: ExecutionContext
  ): { breakdown: CostEstimateResult['materialBreakdown']; totalInr: number; sources: string[] } {
    const existing = this.state.getEstimate();
    if (!existing) {
      throw new Error(
        'No estimate available. Call estimate_full_cost first.'
      );
    }

    return {
      breakdown: existing.materialBreakdown,
      totalInr: existing.totalMaterialCost,
      sources: existing.rates.sources,
    };
  }
}
