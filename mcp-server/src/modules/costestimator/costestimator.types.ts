// src/modules/costestimator/costestimator.types.ts

export type QualityTier = 'basic' | 'standard' | 'premium';
export type CityTier = 'metro' | 'tier2' | 'tier3';

/** Result of geocoding a free-text location */
export interface LocationInfo {
  /** Original query string */
  query: string;
  /** Resolved city name */
  city: string;
  /** Resolved locality / neighbourhood (e.g. "Whitefield") */
  locality?: string;
  /** State / province */
  state?: string;
  country: string;
  lat?: number;
  lng?: number;
  /** Urban classification used for rate lookup */
  tier: CityTier;
}

/** Unit prices fetched live from the internet */
export interface MaterialPrices {
  /** OPC 53-grade, 50 kg bag — INR */
  cementInrPerBag: number;
  /** TMT Fe-500 rebar — INR per kg */
  steelInrPerKg: number;
  /** River sand or M-sand — INR per cubic foot */
  sandInrPerCft: number;
  /** 20 mm crushed aggregate / jelly — INR per cubic foot */
  aggregateInrPerCft: number;
  /** Red clay / fly-ash bricks — INR per 1,000 pieces */
  brickInrPerThousand: number;
  /** Exterior emulsion paint — INR per litre (optional) */
  paintInrPerLitre?: number;
  /** Vitrified tiles (avg) — INR per sq ft (optional) */
  tilesInrPerSqft?: number;
}

/** Aggregated live-fetched rates for a location */
export interface LiveRates {
  /** Construction cost band — INR per sq ft of built-up area */
  constructionRateInrPerSqft: { low: number; high: number; mid: number };
  /** Residential plot rate — INR per sq yard (may be undefined for rural) */
  landRateInrPerSqYd?: { low: number; high: number; mid: number };
  /** Commodity prices fetched from the web */
  materialPrices: MaterialPrices;
  /** ISO timestamp when rates were fetched */
  fetchedAt: string;
  /** Citation URLs from grounded search results */
  sources: string[];
}

/** Per-material line item in the cost breakdown */
export interface MaterialBreakdown {
  item: string;
  quantity: number;
  unit: string;
  unitPriceInr: number;
  totalInr: number;
}

/** Full structured cost estimate returned to the LLM / user */
export interface CostEstimateResult {
  /** planId from the houseplan module (if a model was loaded) */
  planId?: string;
  location: LocationInfo;
  inputs: {
    houseAreaSqFt: number;
    floors: number;
    plotAreaSqYd?: number;
    quality: QualityTier;
    currency: 'INR';
  };
  /** Labour + material construction cost band */
  constructionCost: { low: number; high: number; mid: number };
  /** Land/plot purchase cost band (only if plotAreaSqYd was provided) */
  landCost?: { low: number; high: number; mid: number };
  /** Itemised raw-material cost breakdown */
  materialBreakdown: MaterialBreakdown[];
  /** Sum of all material line items */
  totalMaterialCost: number;
  /** Grand total: construction + land (if applicable) */
  totalProjectCost: { low: number; high: number };
  /** The live rates used */
  rates: LiveRates;
  disclaimer: string;
  fetchedAt: string;
}
