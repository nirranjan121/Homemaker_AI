import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve('../.env') }); // Load environment variables (API keys)

import { CostEstimatorState } from './src/modules/costestimator/costestimator.state.js';
import { GeocoderService } from './src/modules/costestimator/costestimator.geocoder.js';
import { WebSearchService } from './src/modules/costestimator/costestimator.web-search.js';
import { estimateMaterials, totalMaterialCost } from './src/modules/costestimator/costestimator.materials.js';

async function run() {
  const specPath = fs.existsSync(path.resolve('./uploads/3d_model_spec.json'))
    ? path.resolve('./uploads/3d_model_spec.json')
    : path.resolve('../uploads/3d_model_spec.json');
  if (!fs.existsSync(specPath)) {
    console.error(`Spec file not found at ${specPath}`);
    process.exit(1);
  }

  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

  // Sum up rooms area from 3D model spec
  let houseAreaSqFt = 0;
  if (spec.rooms && spec.rooms.length) {
    for (const r of spec.rooms) {
      houseAreaSqFt += r.area_sq_ft || 0;
    }
  }

  if (houseAreaSqFt === 0) {
    houseAreaSqFt = 1000; // default fallback
  }

  const location = process.argv[2] || 'Whitefield, Bengaluru';
  const quality = (process.argv[3] || 'standard') as 'basic' | 'standard' | 'premium';
  const floors = parseInt(process.argv[4] || '1', 10);
  const plotAreaSqYd = process.argv[5] ? parseFloat(process.argv[5]) : undefined;

  console.log(`Running TypeScript Cost Estimator logic...`);
  console.log(`Inputs: area=${houseAreaSqFt} sqft, location="${location}", quality="${quality}", floors=${floors}`);

  // Instantiate the services manually (bypassing NitroStack dependency injection for standalone run)
  const state = new CostEstimatorState();
  const geocoder = new GeocoderService();
  const webSearch = new WebSearchService();

  // 1. Geocode location
  const locationInfo = await geocoder.geocode(location);

  // 2. Fetch live rates
  const liveRates = await webSearch.fetchLiveRates(
    locationInfo.city,
    locationInfo.locality,
    quality
  );

  // 3. Compute construction cost
  const totalAreaForConstruction = houseAreaSqFt * floors;
  const { low: cLow, high: cHigh, mid: cMid } = liveRates.constructionRateInrPerSqft;

  const constructionCost = {
    low: Math.round(totalAreaForConstruction * cLow),
    high: Math.round(totalAreaForConstruction * cHigh),
    mid: Math.round(totalAreaForConstruction * cMid),
  };

  // 4. Compute land cost
  let landCost: { low: number; high: number; mid: number } | undefined;
  if (plotAreaSqYd && liveRates.landRateInrPerSqYd) {
    const { low: lLow, high: lHigh, mid: lMid } = liveRates.landRateInrPerSqYd;
    landCost = {
      low: Math.round(plotAreaSqYd * lLow),
      high: Math.round(plotAreaSqYd * lHigh),
      mid: Math.round(plotAreaSqYd * lMid),
    };
  }

  // 5. Material breakdown
  const materialBreakdown = estimateMaterials(
    totalAreaForConstruction,
    floors,
    quality,
    liveRates.materialPrices
  );
  const matTotal = totalMaterialCost(materialBreakdown);

  // 6. Total project cost
  const totalProjectCost = {
    low: constructionCost.low + (landCost?.low ?? 0),
    high: constructionCost.high + (landCost?.high ?? 0),
  };

  const estimate = {
    location: locationInfo,
    inputs: {
      houseAreaSqFt: Math.round(totalAreaForConstruction),
      floors,
      plotAreaSqYd,
      quality,
      currency: 'INR',
    },
    constructionCost,
    landCost,
    materialBreakdown,
    totalMaterialCost: matTotal,
    totalProjectCost,
    rates: liveRates,
    disclaimer:
      'Feasibility-stage estimate based on live internet data. ' +
      'Construction costs include labour + materials (±20-30% variance). ' +
      'Land rates are indicative market averages. ' +
      'Engage a structural engineer and quantity surveyor for a formal BOQ before procurement.',
    fetchedAt: liveRates.fetchedAt,
  };

  const outputPath = fs.existsSync(path.resolve('./uploads'))
    ? path.resolve('./uploads/cost_estimate_report.json')
    : path.resolve('../uploads/cost_estimate_report.json');
  fs.writeFileSync(outputPath, JSON.stringify(estimate, null, 2), 'utf8');
  console.log(`Cost estimate report successfully written to ${outputPath}`);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
