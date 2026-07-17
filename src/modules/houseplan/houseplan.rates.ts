// src/modules/houseplan/houseplan.rates.ts

export type QualityTier = 'basic' | 'standard' | 'premium';

/**
 * Rough per-sq-ft rate bands (INR), by city tier and quality.
 * Sourced from published 2026 construction-cost guides, not a trained model —
 * these are starting bands, not a quote. Update periodically or replace the
 * lookup with a live web-search call at request time (see estimate_cost tool
 * docstring for where to wire that in).
 */
const RATE_TABLE_INR_PER_SQFT: Record<
  'metro' | 'tier2' | 'tier3',
  Record<QualityTier, [number, number]>
> = {
  metro: { basic: [1800, 2500], standard: [2500, 3500], premium: [3500, 5000] },
  tier2: { basic: [1500, 2000], standard: [2000, 2800], premium: [2800, 4000] },
  tier3: { basic: [1200, 1700], standard: [1700, 2300], premium: [2300, 3200] }
};

const METRO_CITIES = new Set([
  'mumbai', 'delhi', 'bengaluru', 'bangalore', 'chennai',
  'hyderabad', 'pune', 'kolkata'
]);
const TIER2_CITIES = new Set([
  'kochi', 'thiruvananthapuram', 'coimbatore', 'jaipur',
  'lucknow', 'nagpur', 'indore', 'ahmedabad', 'surat'
]);

/**
 * STUB geocode/city-resolution. Replace with a real Google Maps Geocoding
 * API call (GOOGLE_MAPS_API_KEY in .env) that turns a free-text location
 * into a city name + lat/lng. Kept as a plain string match here so the tool
 * pipeline works end-to-end without a live API key during early dev.
 */
export function resolveCityTier(locationQuery: string): {
  city: string;
  tier: 'metro' | 'tier2' | 'tier3';
} {
  const normalized = locationQuery.trim().toLowerCase();
  if (METRO_CITIES.has(normalized)) return { city: normalized, tier: 'metro' };
  if (TIER2_CITIES.has(normalized)) return { city: normalized, tier: 'tier2' };
  return { city: normalized || 'unknown', tier: 'tier3' };
}

export function getRateRangeInrPerSqft(
  tier: 'metro' | 'tier2' | 'tier3',
  quality: QualityTier
): [number, number] {
  return RATE_TABLE_INR_PER_SQFT[tier][quality];
}
