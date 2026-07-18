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
 * Estimate material quantities and costs.
 *
 * @param houseAreaSqFt   Total built-up area in sq ft (all floors combined)
 * @param floors          Number of floors (already factored into houseAreaSqFt)
 * @param quality         Construction quality tier
 * @param prices          Live unit prices from WebSearchService
 * @returns               Array of MaterialBreakdown line items
 */
export declare function estimateMaterials(houseAreaSqFt: number, _floors: number, quality: QualityTier, prices: MaterialPrices): MaterialBreakdown[];
/**
 * Sum all material line items.
 */
export declare function totalMaterialCost(breakdown: MaterialBreakdown[]): number;
//# sourceMappingURL=costestimator.materials.d.ts.map