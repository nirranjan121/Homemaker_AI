import type { LiveRates } from './costestimator.types.js';
export declare class WebSearchService {
    private genAI;
    constructor();
    /**
     * Fetch all live rates for a given location + quality tier.
     * Falls back to conservative hardcoded ranges if Gemini / network is unavailable.
     */
    fetchLiveRates(city: string, locality: string | undefined, quality: 'basic' | 'standard' | 'premium'): Promise<LiveRates>;
    private searchConstructionRates;
    private searchLandRates;
    private searchMaterialPrices;
    private groundedSearch;
    private extractNumbers;
    private defaultConstructionRates;
    private defaultMaterialPrices;
    private fallbackRates;
}
//# sourceMappingURL=costestimator.web-search.d.ts.map