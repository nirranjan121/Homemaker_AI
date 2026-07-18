var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var CostEstimatorState_1;
// src/modules/costestimator/costestimator.state.ts
import { Injectable } from '@nitrostack/core';
/**
 * In-memory cache for the most recent cost estimate and geocode result.
 *
 * Caching the geocode + live rates avoids redundant API calls when the user
 * tweaks a single parameter (e.g. changes quality tier). Rates are considered
 * stale after CACHE_TTL_MS and will be re-fetched automatically.
 */
let CostEstimatorState = class CostEstimatorState {
    static { CostEstimatorState_1 = this; }
    /** How long (ms) to keep a cached rate set before re-fetching. 30 minutes. */
    static CACHE_TTL_MS = 30 * 60 * 1_000;
    latestEstimate = null;
    cachedLocation = null;
    cachedRates = null;
    ratesFetchedAt = null;
    // ── Estimate ──────────────────────────────────────────────────────────────
    setEstimate(estimate) {
        this.latestEstimate = estimate;
    }
    getEstimate() {
        return this.latestEstimate;
    }
    hasEstimate() {
        return this.latestEstimate !== null;
    }
    // ── Location (geocode cache) ──────────────────────────────────────────────
    setLocation(loc) {
        this.cachedLocation = loc;
    }
    getLocation() {
        return this.cachedLocation;
    }
    /**
     * Returns true if the cached location query matches (case-insensitive),
     * so we skip a repeat geocode call.
     */
    locationMatches(query) {
        return (this.cachedLocation !== null &&
            this.cachedLocation.query.toLowerCase() === query.toLowerCase());
    }
    // ── Live rates (TTL cache) ────────────────────────────────────────────────
    setRates(rates) {
        this.cachedRates = rates;
        this.ratesFetchedAt = Date.now();
    }
    /**
     * Returns cached rates if they are still fresh; null otherwise.
     * Rates are keyed by location query — if the location changes the caller
     * must call setRates() again.
     */
    getRatesIfFresh() {
        if (!this.cachedRates || !this.ratesFetchedAt)
            return null;
        if (Date.now() - this.ratesFetchedAt > CostEstimatorState_1.CACHE_TTL_MS)
            return null;
        return this.cachedRates;
    }
    clearRates() {
        this.cachedRates = null;
        this.ratesFetchedAt = null;
    }
};
CostEstimatorState = CostEstimatorState_1 = __decorate([
    Injectable()
], CostEstimatorState);
export { CostEstimatorState };
//# sourceMappingURL=costestimator.state.js.map