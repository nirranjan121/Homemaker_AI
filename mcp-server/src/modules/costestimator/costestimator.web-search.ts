// src/modules/costestimator/costestimator.web-search.ts

/**
 * WebSearchService — fetches live construction & land rates plus commodity
 * prices using Gemini 2.0 Flash with Google Search grounding.
 *
 * Three parallel grounded searches are issued per estimate:
 *   1. Construction cost per sq ft for the target location
 *   2. Residential plot price per sq yard for the target location
 *   3. Current commodity prices (cement, steel, sand, aggregate, bricks) across India
 *
 * Each grounded response is then parsed into structured numbers by a second
 * (non-grounded) Gemini call acting as a numeric extractor.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { Injectable } from '@nitrostack/core';
import type { LiveRates, MaterialPrices } from './costestimator.types.js';

@Injectable()
export class WebSearchService {
  private genAI: GoogleGenerativeAI | null = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
  }

  /**
   * Fetch all live rates for a given location + quality tier.
   * Falls back to conservative hardcoded ranges if Gemini / network is unavailable.
   */
  async fetchLiveRates(
    city: string,
    locality: string | undefined,
    quality: 'basic' | 'standard' | 'premium'
  ): Promise<LiveRates> {
    const locationStr = locality ? `${locality}, ${city}` : city;
    const now = new Date().toISOString();

    if (!this.genAI) {
      console.warn('[WebSearch] No GEMINI_API_KEY — using hardcoded fallback rates');
      return this.fallbackRates(city, quality, now);
    }

    try {
      // Issue all three searches in parallel
      const [constructionResult, landResult, materialResult] = await Promise.allSettled([
        this.searchConstructionRates(locationStr, quality),
        this.searchLandRates(locationStr),
        this.searchMaterialPrices(),
      ]);

      const constructionData = constructionResult.status === 'fulfilled'
        ? constructionResult.value
        : this.defaultConstructionRates(city, quality);

      const landData = landResult.status === 'fulfilled'
        ? landResult.value
        : undefined;

      const materialData = materialResult.status === 'fulfilled'
        ? materialResult.value
        : this.defaultMaterialPrices();

      const sources = [
        ...(constructionResult.status === 'fulfilled' ? constructionResult.value.sources : []),
        ...(landResult.status === 'fulfilled' && landResult.value ? landResult.value.sources : []),
        ...(materialResult.status === 'fulfilled' ? materialResult.value.sources : []),
      ].filter(Boolean);

      return {
        constructionRateInrPerSqft: constructionData.rate,
        landRateInrPerSqYd: landData?.rate,
        materialPrices: materialData.prices,
        fetchedAt: now,
        sources: [...new Set(sources)],
      };
    } catch (err) {
      console.warn('[WebSearch] Parallel fetch failed, using fallback:', err);
      return this.fallbackRates(city, quality, now);
    }
  }

  // ── 1. Construction rates ──────────────────────────────────────────────────
  private async searchConstructionRates(
    location: string,
    quality: string
  ): Promise<{ rate: { low: number; high: number; mid: number }; sources: string[] }> {
    const year = new Date().getFullYear();
    const query =
      `residential house construction cost per sq ft ${location} India ${year} ` +
      `${quality} quality civil contractor rate`;

    const { text, sources } = await this.groundedSearch(query);

    const extracted = await this.extractNumbers(text, `
Extract the construction cost per square foot (sq ft) range in INR for ${location}.
Return ONLY this JSON (no markdown):
{
  "low": <lower bound INR/sqft, integer>,
  "high": <upper bound INR/sqft, integer>
}
If only a single number is found, set low = number * 0.85, high = number * 1.15.
If nothing found, return { "low": 2000, "high": 3500 }.
`);

    const low = extracted.low ?? 2000;
    const high = extracted.high ?? 3500;
    const mid = Math.round((low + high) / 2);

    return { rate: { low, high, mid }, sources };
  }

  // ── 2. Land / plot rates ───────────────────────────────────────────────────
  private async searchLandRates(
    location: string
  ): Promise<{ rate: { low: number; high: number; mid: number }; sources: string[] } | undefined> {
    const year = new Date().getFullYear();
    const query =
      `residential plot land price per square yard ${location} India ${year} ` +
      `property market rate sq yard`;

    const { text, sources } = await this.groundedSearch(query);

    const extracted = await this.extractNumbers(text, `
Extract the residential plot / land price per square yard in INR for ${location}.
Return ONLY this JSON (no markdown):
{
  "low": <lower bound INR/sqyd, integer>,
  "high": <upper bound INR/sqyd, integer>
}
If only one number found, set low = number * 0.8, high = number * 1.2.
If nothing found or data is unavailable, return { "low": null, "high": null }.
`);

    if (!extracted.low || !extracted.high) return undefined;
    const mid = Math.round((extracted.low + extracted.high) / 2);
    return { rate: { low: extracted.low, high: extracted.high, mid }, sources };
  }

  // ── 3. Material / commodity prices ──────────────────────────────────────────
  private async searchMaterialPrices(): Promise<{ prices: MaterialPrices; sources: string[] }> {
    const year = new Date().getFullYear();
    const query =
      `India construction material prices ${year}: OPC cement 50kg bag price, ` +
      `TMT steel rebar price per kg, river sand M-sand price per cft, ` +
      `20mm aggregate jelly price per cft, red brick price per 1000`;

    const { text, sources } = await this.groundedSearch(query);

    const extracted = await this.extractNumbers(text, `
Extract current Indian construction material prices from the text.
Return ONLY this JSON (no markdown, all values in INR):
{
  "cementInrPerBag": <OPC 50kg bag price, integer, typically 350-550>,
  "steelInrPerKg": <TMT rebar per kg, integer, typically 55-80>,
  "sandInrPerCft": <M-sand or river sand per cubic foot, integer, typically 40-80>,
  "aggregateInrPerCft": <20mm aggregate per cft, integer, typically 30-60>,
  "brickInrPerThousand": <red/flyash bricks per 1000, integer, typically 5000-9000>,
  "paintInrPerLitre": <exterior emulsion per litre, integer, typically 200-400>,
  "tilesInrPerSqft": <vitrified tiles avg per sqft, integer, typically 40-120>
}
Use your best estimate for missing values based on typical Indian market prices.
`);

    return {
      prices: {
        cementInrPerBag: extracted.cementInrPerBag ?? 430,
        steelInrPerKg: extracted.steelInrPerKg ?? 68,
        sandInrPerCft: extracted.sandInrPerCft ?? 55,
        aggregateInrPerCft: extracted.aggregateInrPerCft ?? 45,
        brickInrPerThousand: extracted.brickInrPerThousand ?? 7000,
        paintInrPerLitre: extracted.paintInrPerLitre ?? 280,
        tilesInrPerSqft: extracted.tilesInrPerSqft ?? 75,
      },
      sources,
    };
  }

  // ── Gemini grounded search helper ──────────────────────────────────────────
  private async groundedSearch(query: string): Promise<{ text: string; sources: string[] }> {
    const model = this.genAI!.getGenerativeModel({
      model: 'gemini-2.0-flash',
      // Enable Google Search grounding to get live, cited results
      tools: [{ googleSearch: {} }] as any,
      generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
    });

    const result = await model.generateContent(query);
    const text = result.response.text();

    // Extract citation URLs from grounding metadata
    const candidates = result.response.candidates ?? [];
    const sources: string[] = [];
    for (const candidate of candidates) {
      const meta = (candidate as any).groundingMetadata;
      if (!meta) continue;
      const chunks = meta.groundingChunks ?? [];
      for (const chunk of chunks) {
        const uri = chunk?.web?.uri;
        if (uri) sources.push(uri);
      }
    }

    return { text, sources };
  }

  // ── Structured number extractor (non-grounded) ─────────────────────────────
  private async extractNumbers(
    sourceText: string,
    instructions: string
  ): Promise<Record<string, number | null>> {
    const model = this.genAI!.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: { temperature: 0, maxOutputTokens: 512 },
    });

    const prompt = `
${instructions}

Source text:
"""
${sourceText.substring(0, 3000)}
"""
`.trim();

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '');
      return JSON.parse(text);
    } catch {
      return {};
    }
  }

  // ── Fallback + default helpers ─────────────────────────────────────────────

  private defaultConstructionRates(
    city: string,
    quality: 'basic' | 'standard' | 'premium'
  ): { rate: { low: number; high: number; mid: number }; sources: string[] } {
    // Conservative static bands as an absolute last resort
    const bands: Record<string, Record<typeof quality, [number, number]>> = {
      metro:  { basic: [1800, 2500], standard: [2500, 3500], premium: [3500, 5000] },
      tier2:  { basic: [1500, 2000], standard: [2000, 2800], premium: [2800, 4000] },
      tier3:  { basic: [1200, 1700], standard: [1700, 2300], premium: [2300, 3200] },
    };
    const tierKey = ['mumbai','delhi','bengaluru','bangalore','chennai','hyderabad','pune','kolkata','ahmedabad']
      .includes(city.toLowerCase()) ? 'metro'
      : ['kochi','jaipur','lucknow','nagpur','indore','surat'].includes(city.toLowerCase()) ? 'tier2'
      : 'tier3';

    const [low, high] = bands[tierKey][quality];
    return { rate: { low, high, mid: Math.round((low + high) / 2) }, sources: [] };
  }

  private defaultMaterialPrices(): { prices: MaterialPrices; sources: string[] } {
    return {
      prices: {
        cementInrPerBag: 430,
        steelInrPerKg: 68,
        sandInrPerCft: 55,
        aggregateInrPerCft: 45,
        brickInrPerThousand: 7000,
        paintInrPerLitre: 280,
        tilesInrPerSqft: 75,
      },
      sources: [],
    };
  }

  private fallbackRates(city: string, quality: 'basic' | 'standard' | 'premium', now: string): LiveRates {
    const constr = this.defaultConstructionRates(city, quality);
    const mat = this.defaultMaterialPrices();
    return {
      constructionRateInrPerSqft: constr.rate,
      materialPrices: mat.prices,
      fetchedAt: now,
      sources: [],
    };
  }
}
