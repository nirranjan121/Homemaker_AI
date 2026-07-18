var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
let CostEstimatorModule = class CostEstimatorModule {
};
CostEstimatorModule = __decorate([
    Module({
        name: 'CostEstimatorModule',
        controllers: [CostEstimatorTools],
        providers: [CostEstimatorState, GeocoderService, WebSearchService],
    })
], CostEstimatorModule);
export { CostEstimatorModule };
//# sourceMappingURL=costestimator.module.js.map