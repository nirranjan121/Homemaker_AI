import type { CostEstimateResult, LocationInfo, LiveRates } from './costestimator.types.js';
/**
 * In-memory cache for the most recent cost estimate and geocode result.
 *
 * Caching the geocode + live rates avoids redundant API calls when the user
 * tweaks a single parameter (e.g. changes quality tier). Rates are considered
 * stale after CACHE_TTL_MS and will be re-fetched automatically.
 */
export declare class CostEstimatorState {
    /** How long (ms) to keep a cached rate set before re-fetching. 30 minutes. */
    private static readonly CACHE_TTL_MS;
    private latestEstimate;
    private cachedLocation;
    private cachedRates;
    private ratesFetchedAt;
    setEstimate(estimate: CostEstimateResult): void;
    getEstimate(): CostEstimateResult | null;
    hasEstimate(): boolean;
    setLocation(loc: LocationInfo): void;
    getLocation(): LocationInfo | null;
    /**
     * Returns true if the cached location query matches (case-insensitive),
     * so we skip a repeat geocode call.
     */
    locationMatches(query: string): boolean;
    setRates(rates: LiveRates): void;
    /**
     * Returns cached rates if they are still fresh; null otherwise.
     * Rates are keyed by location query — if the location changes the caller
     * must call setRates() again.
     */
    getRatesIfFresh(): LiveRates | null;
    clearRates(): void;
}
//# sourceMappingURL=costestimator.state.d.ts.map