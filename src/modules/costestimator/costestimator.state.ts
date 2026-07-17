// src/modules/costestimator/costestimator.state.ts
import { Injectable } from '@nitrostack/core';
import type { CostEstimateResult, LocationInfo, LiveRates } from './costestimator.types.js';

/**
 * In-memory cache for the most recent cost estimate and geocode result.
 *
 * Caching the geocode + live rates avoids redundant API calls when the user
 * tweaks a single parameter (e.g. changes quality tier). Rates are considered
 * stale after CACHE_TTL_MS and will be re-fetched automatically.
 */
@Injectable()
export class CostEstimatorState {
  /** How long (ms) to keep a cached rate set before re-fetching. 30 minutes. */
  private static readonly CACHE_TTL_MS = 30 * 60 * 1_000;

  private latestEstimate: CostEstimateResult | null = null;
  private cachedLocation: LocationInfo | null = null;
  private cachedRates: LiveRates | null = null;
  private ratesFetchedAt: number | null = null;

  // ── Estimate ──────────────────────────────────────────────────────────────

  setEstimate(estimate: CostEstimateResult): void {
    this.latestEstimate = estimate;
  }

  getEstimate(): CostEstimateResult | null {
    return this.latestEstimate;
  }

  hasEstimate(): boolean {
    return this.latestEstimate !== null;
  }

  // ── Location (geocode cache) ──────────────────────────────────────────────

  setLocation(loc: LocationInfo): void {
    this.cachedLocation = loc;
  }

  getLocation(): LocationInfo | null {
    return this.cachedLocation;
  }

  /**
   * Returns true if the cached location query matches (case-insensitive),
   * so we skip a repeat geocode call.
   */
  locationMatches(query: string): boolean {
    return (
      this.cachedLocation !== null &&
      this.cachedLocation.query.toLowerCase() === query.toLowerCase()
    );
  }

  // ── Live rates (TTL cache) ────────────────────────────────────────────────

  setRates(rates: LiveRates): void {
    this.cachedRates = rates;
    this.ratesFetchedAt = Date.now();
  }

  /**
   * Returns cached rates if they are still fresh; null otherwise.
   * Rates are keyed by location query — if the location changes the caller
   * must call setRates() again.
   */
  getRatesIfFresh(): LiveRates | null {
    if (!this.cachedRates || !this.ratesFetchedAt) return null;
    if (Date.now() - this.ratesFetchedAt > CostEstimatorState.CACHE_TTL_MS) return null;
    return this.cachedRates;
  }

  clearRates(): void {
    this.cachedRates = null;
    this.ratesFetchedAt = null;
  }
}
