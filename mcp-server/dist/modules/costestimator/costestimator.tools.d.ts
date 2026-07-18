import { ExecutionContext } from '@nitrostack/core';
import { CostEstimatorState } from './costestimator.state.js';
import { GeocoderService } from './costestimator.geocoder.js';
import { WebSearchService } from './costestimator.web-search.js';
import type { CostEstimateResult, QualityTier } from './costestimator.types.js';
import { HouseplanState } from '../houseplan/houseplan.state.js';
export declare class CostEstimatorTools {
    private readonly state;
    private readonly houseplanState;
    private readonly geocoder;
    private readonly webSearch;
    constructor(state: CostEstimatorState, houseplanState: HouseplanState, geocoder: GeocoderService, webSearch: WebSearchService);
    estimateFullCost(input: {
        location: string;
        quality: QualityTier;
        floors: number;
        houseAreaSqFt?: number;
        plotAreaSqYd?: number;
    }, _ctx: ExecutionContext): Promise<CostEstimateResult & {
        summary: string;
    }>;
    refineCostEstimate(input: {
        quality?: QualityTier;
        floors?: number;
        plotAreaSqYd?: number;
        location?: string;
    }, ctx: ExecutionContext): Promise<CostEstimateResult & {
        summary: string;
    }>;
    getMaterialBreakdown(_input: {}, _ctx: ExecutionContext): {
        breakdown: CostEstimateResult['materialBreakdown'];
        totalInr: number;
        sources: string[];
    };
}
//# sourceMappingURL=costestimator.tools.d.ts.map