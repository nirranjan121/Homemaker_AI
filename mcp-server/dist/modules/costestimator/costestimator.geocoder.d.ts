import type { LocationInfo } from './costestimator.types.js';
/**
 * GeocoderService — turns a free-text location string into a structured
 * LocationInfo object with lat/lng and city tier.
 *
 * Strategy (in order of preference):
 *   1. Google Maps Geocoding API — if GOOGLE_MAPS_API_KEY is set
 *   2. Gemini 2.0 Flash fallback — parses the location semantically
 */
export declare class GeocoderService {
    private readonly mapsApiKey;
    private readonly geminiKey;
    geocode(query: string): Promise<LocationInfo>;
    private geocodeWithMaps;
    private extractComponent;
    private geocodeWithGemini;
    private heuristicGeocode;
}
//# sourceMappingURL=costestimator.geocoder.d.ts.map