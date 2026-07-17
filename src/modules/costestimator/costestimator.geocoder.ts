// src/modules/costestimator/costestimator.geocoder.ts

import type { LocationInfo, CityTier } from './costestimator.types.js';
import { Injectable } from '@nitrostack/core';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ── Metro / Tier-2 city lists for tier classification ─────────────────────
const METRO_CITIES = new Set([
  'mumbai', 'delhi', 'new delhi', 'bengaluru', 'bangalore',
  'chennai', 'hyderabad', 'pune', 'kolkata', 'ahmedabad',
]);

const TIER2_CITIES = new Set([
  'kochi', 'cochin', 'thiruvananthapuram', 'trivandrum', 'coimbatore',
  'jaipur', 'lucknow', 'nagpur', 'indore', 'surat', 'vadodara',
  'bhopal', 'patna', 'ludhiana', 'agra', 'nashik', 'faridabad',
  'meerut', 'rajkot', 'varanasi', 'srinagar', 'aurangabad',
  'amritsar', 'ranchi', 'chandigarh', 'guwahati',
]);

/**
 * Classify a city name into a market tier.
 */
function classifyTier(city: string): CityTier {
  const normalized = city.trim().toLowerCase();
  if (METRO_CITIES.has(normalized)) return 'metro';
  if (TIER2_CITIES.has(normalized)) return 'tier2';
  return 'tier3';
}

/**
 * GeocoderService — turns a free-text location string into a structured
 * LocationInfo object with lat/lng and city tier.
 *
 * Strategy (in order of preference):
 *   1. Google Maps Geocoding API — if GOOGLE_MAPS_API_KEY is set
 *   2. Gemini 2.0 Flash fallback — parses the location semantically
 */
@Injectable()
export class GeocoderService {
  private readonly mapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
  private readonly geminiKey = process.env.GEMINI_API_KEY;

  async geocode(query: string): Promise<LocationInfo> {
    if (this.mapsApiKey) {
      try {
        return await this.geocodeWithMaps(query);
      } catch (err) {
        console.warn('[Geocoder] Google Maps call failed, falling back to Gemini:', err);
      }
    }

    if (this.geminiKey) {
      try {
        return await this.geocodeWithGemini(query);
      } catch (err) {
        console.warn('[Geocoder] Gemini geocoding failed, using heuristic fallback:', err);
      }
    }

    // Last-resort heuristic — just tokenize the query
    return this.heuristicGeocode(query);
  }

  // ── 1. Google Maps Geocoding API ────────────────────────────────────────
  private async geocodeWithMaps(query: string): Promise<LocationInfo> {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', `${query}, India`);
    url.searchParams.set('key', this.mapsApiKey!);

    const resp = await fetch(url.toString());
    if (!resp.ok) throw new Error(`Maps API HTTP ${resp.status}`);

    const data = await resp.json() as GoogleMapsGeocodeResponse;
    if (data.status !== 'OK' || !data.results.length) {
      throw new Error(`Maps API returned status: ${data.status}`);
    }

    const result = data.results[0];
    const components = result.address_components;

    const locality = this.extractComponent(components, 'sublocality', 'locality');
    const city = this.extractComponent(components, 'locality', 'administrative_area_level_2') || locality;
    const state = this.extractComponent(components, 'administrative_area_level_1');
    const country = this.extractComponent(components, 'country') || 'India';

    const { lat, lng } = result.geometry.location;

    return {
      query,
      city: city || query,
      locality: locality !== city ? locality : undefined,
      state,
      country,
      lat,
      lng,
      tier: classifyTier(city || query),
    };
  }

  private extractComponent(
    components: GoogleAddressComponent[],
    ...types: string[]
  ): string {
    for (const type of types) {
      const match = components.find((c) => c.types.includes(type));
      if (match) return match.long_name;
    }
    return '';
  }

  // ── 2. Gemini fallback geocoder ─────────────────────────────────────────
  private async geocodeWithGemini(query: string): Promise<LocationInfo> {
    const genAI = new GoogleGenerativeAI(this.geminiKey!);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: { temperature: 0, maxOutputTokens: 256 },
    });

    const prompt = `
You are a geocoding assistant. Given this location query, extract the following and respond ONLY with valid JSON:
Query: "${query}"

JSON format (no markdown):
{
  "city": "<nearest major city>",
  "locality": "<neighbourhood or area if present, else null>",
  "state": "<Indian state name>",
  "country": "India",
  "lat": <approximate latitude, number>,
  "lng": <approximate longitude, number>
}
`.trim();

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '');

    const parsed = JSON.parse(text) as {
      city: string; locality: string | null; state: string;
      country: string; lat: number; lng: number;
    };

    return {
      query,
      city: parsed.city,
      locality: parsed.locality ?? undefined,
      state: parsed.state,
      country: parsed.country || 'India',
      lat: parsed.lat,
      lng: parsed.lng,
      tier: classifyTier(parsed.city),
    };
  }

  // ── 3. Heuristic last-resort ─────────────────────────────────────────────
  private heuristicGeocode(query: string): LocationInfo {
    // Split "Whitefield, Bengaluru" → locality=Whitefield, city=Bengaluru
    const parts = query.split(',').map((p) => p.trim());
    const city = parts.length > 1 ? parts[parts.length - 1] : parts[0];
    const locality = parts.length > 1 ? parts[0] : undefined;

    return {
      query,
      city,
      locality,
      state: undefined,
      country: 'India',
      tier: classifyTier(city),
    };
  }
}

// ── Google Maps API response types ──────────────────────────────────────────
interface GoogleAddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

interface GoogleMapsGeocodeResponse {
  status: string;
  results: Array<{
    address_components: GoogleAddressComponent[];
    formatted_address: string;
    geometry: { location: { lat: number; lng: number } };
  }>;
}
