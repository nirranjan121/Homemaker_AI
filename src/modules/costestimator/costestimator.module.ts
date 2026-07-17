// src/modules/costestimator/costestimator.module.ts
import { Module } from '@nitrostack/core';
import { CostEstimatorTools } from './costestimator.tools.js';
import { CostEstimatorState } from './costestimator.state.js';
import { GeocoderService } from './costestimator.geocoder.js';
import { WebSearchService } from './costestimator.web-search.js';

/**
 * CostEstimatorModule
 *
 * Provides three MCP tools:
 *   - estimate_full_cost     — full internet-sourced cost estimate
 *   - refine_cost_estimate   — quick re-run with changed params
 *   - get_material_breakdown — itemised material list from last estimate
 *
 * Depends on HouseplanModule being registered in the app (to read floor area
 * from HouseplanState). HouseplanState is imported from HouseplanModule exports.
 */
@Module({
  name: 'CostEstimatorModule',
  controllers: [CostEstimatorTools],
  providers: [CostEstimatorState, GeocoderService, WebSearchService],
})
export class CostEstimatorModule {}
