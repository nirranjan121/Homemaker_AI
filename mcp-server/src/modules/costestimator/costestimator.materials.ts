// src/modules/costestimator/costestimator.materials.ts

/**
 * Material quantity estimator — uses standard Indian civil-engineering
 * thumb rules to compute how much raw material is needed for a given
 * built-up area, then multiplies by live unit prices from the web.
 *
 * References:
 *   - IS 456:2000 (Plain & Reinforced Concrete)
 *   - Standard civil-engineering handbooks (Arora & Bindra)
 *   - Typical contractor experience rules for residential construction
 *
 * IMPORTANT: These are ORDER-OF-MAGNITUDE estimates for budgeting.
 * A detailed Bill of Quantities (BOQ) from a structural engineer is required
 * for actual procurement.
 */

import type { MaterialBreakdown, MaterialPrices } from './costestimator.types.js';

export type QualityTier = 'basic' | 'standard' | 'premium';

/**
 * Quality multipliers — premium finishes use more material per sq ft.
 */
const QUALITY_MULTIPLIER: Record<QualityTier, number> = {
  basic: 0.85,
  standard: 1.0,
  premium: 1.25,
};

/**
 * Base material quantities per 1,000 sq ft of built-up area (single floor, RCC frame).
 *
 *  Cement    : ~400 bags  (50 kg OPC 53)
 *  Steel     : ~4,000 kg  (Fe-500 TMT rebar; ~4 kg/sqft)
 *  Sand      : ~900 cft   (for mortar, plastering, brickwork)
 *  Aggregate : ~1,100 cft (20 mm jelly for slabs + columns)
 *  Bricks    : ~8,500 nos (for 9" external + 4.5" internal walls)
 *  Paint     : ~30 L      (exterior emulsion, 2 coats)
 *  Tiles     : ~1,000 sqft (floor tiles — equal to floor area)
 */
const BASE_PER_1000_SQFT = {
  cementBags: 400,
  steelKg: 4_000,
  sandCft: 900,
  aggregateCft: 1_100,
  brickCount: 8_500,
  paintLitres: 30,
  tilesSqft: 1_000,
};

/**
 * Estimate material quantities and costs.
 *
 * @param houseAreaSqFt   Total built-up area in sq ft (all floors combined)
 * @param floors          Number of floors (already factored into houseAreaSqFt)
 * @param quality         Construction quality tier
 * @param prices          Live unit prices from WebSearchService
 * @returns               Array of MaterialBreakdown line items
 */
export function estimateMaterials(
  houseAreaSqFt: number,
  _floors: number,
  quality: QualityTier,
  prices: MaterialPrices
): MaterialBreakdown[] {
  const factor = (houseAreaSqFt / 1_000) * QUALITY_MULTIPLIER[quality];

  const items: Array<{
    item: string;
    quantity: number;
    unit: string;
    unitPriceInr: number;
  }> = [
    {
      item: 'OPC Cement (53-grade)',
      quantity: Math.round(BASE_PER_1000_SQFT.cementBags * factor),
      unit: 'bags (50 kg)',
      unitPriceInr: prices.cementInrPerBag,
    },
    {
      item: 'TMT Steel Rebar (Fe-500)',
      quantity: Math.round(BASE_PER_1000_SQFT.steelKg * factor),
      unit: 'kg',
      unitPriceInr: prices.steelInrPerKg,
    },
    {
      item: 'River Sand / M-Sand',
      quantity: Math.round(BASE_PER_1000_SQFT.sandCft * factor),
      unit: 'cft',
      unitPriceInr: prices.sandInrPerCft,
    },
    {
      item: '20 mm Aggregate (Jelly)',
      quantity: Math.round(BASE_PER_1000_SQFT.aggregateCft * factor),
      unit: 'cft',
      unitPriceInr: prices.aggregateInrPerCft,
    },
    {
      item: 'Bricks (Red Clay / Fly-Ash)',
      quantity: Math.round(BASE_PER_1000_SQFT.brickCount * factor),
      unit: 'nos',
      unitPriceInr: Math.round(prices.brickInrPerThousand / 1_000),
    },
  ];

  // Optional items (only if prices are available)
  if (prices.paintInrPerLitre) {
    items.push({
      item: 'Exterior Emulsion Paint',
      quantity: Math.round(BASE_PER_1000_SQFT.paintLitres * factor),
      unit: 'litres',
      unitPriceInr: prices.paintInrPerLitre,
    });
  }

  if (prices.tilesInrPerSqft) {
    items.push({
      item: 'Vitrified Floor Tiles',
      quantity: Math.round(houseAreaSqFt * QUALITY_MULTIPLIER[quality]),
      unit: 'sq ft',
      unitPriceInr: prices.tilesInrPerSqft,
    });
  }

  return items.map((item) => ({
    ...item,
    totalInr: Math.round(item.quantity * item.unitPriceInr),
  }));
}

/**
 * Sum all material line items.
 */
export function totalMaterialCost(breakdown: MaterialBreakdown[]): number {
  return breakdown.reduce((sum, item) => sum + item.totalInr, 0);
}
