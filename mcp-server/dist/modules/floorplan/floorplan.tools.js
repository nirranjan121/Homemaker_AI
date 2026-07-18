var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { ToolDecorator as Tool, z, Injectable } from '@nitrostack/core';
import { preprocessImage } from './preprocess.service.js';
import { analyzeFloorPlan } from './gemini.service.js';
import { validateAndRepair } from './validator.service.js';
import { GeocoderService } from '../costestimator/costestimator.geocoder.js';
import { WebSearchService } from '../costestimator/costestimator.web-search.js';
import { estimateMaterials, totalMaterialCost } from '../costestimator/costestimator.materials.js';
import { ChatbotAgent } from '../chatbot/agent/chatbot-agent.js';
let floorplanTools = class floorplanTools {
    async analyzeFloorPlan(input, context) {
        context.logger.info(`Running native analyze_floor_plan...`);
        // Strip data:image/...;base64, if present
        const base64Data = input.image_b64.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');
        // 1. Preprocess
        const processed = await preprocessImage(buffer);
        // 2. Gemini Parse
        const plan = await analyzeFloorPlan(processed.image_b64, processed.width, processed.height, processed.mime_type);
        // 3. Math Geometry Validation
        const validatedPlan = validateAndRepair(plan, processed.width, processed.height);
        return {
            plan: validatedPlan,
            processed_image: `data:${processed.mime_type};base64,${processed.image_b64}`
        };
    }
    async estimateCost(input, context) {
        context.logger.info(`Running native estimateCost...`);
        let houseAreaSqFt = 0;
        if (input.plan?.rooms?.length) {
            for (const r of input.plan.rooms) {
                houseAreaSqFt += r.area_sq_ft || 0;
            }
        }
        if (houseAreaSqFt === 0)
            houseAreaSqFt = 1000;
        const geocoder = new GeocoderService();
        const webSearch = new WebSearchService();
        const quality = input.quality;
        const floors = 1;
        const locationInfo = await geocoder.geocode(input.location);
        const liveRates = await webSearch.fetchLiveRates(locationInfo.city, locationInfo.locality, quality);
        const totalAreaForConstruction = houseAreaSqFt * floors;
        const { low: cLow, high: cHigh, mid: cMid } = liveRates.constructionRateInrPerSqft;
        const constructionCost = {
            low: Math.round(totalAreaForConstruction * cLow),
            high: Math.round(totalAreaForConstruction * cHigh),
            mid: Math.round(totalAreaForConstruction * cMid),
        };
        const materialBreakdown = estimateMaterials(totalAreaForConstruction, floors, quality, liveRates.materialPrices);
        const matTotal = totalMaterialCost(materialBreakdown);
        return {
            location: locationInfo,
            inputs: { houseAreaSqFt: Math.round(totalAreaForConstruction), floors, quality, currency: 'INR' },
            constructionCost,
            materialBreakdown,
            totalMaterialCost: matTotal,
            rates: liveRates,
            fetchedAt: liveRates.fetchedAt,
        };
    }
    async chat(input, context) {
        context.logger.info(`Running native chat...`);
        const agent = new ChatbotAgent();
        return await agent.answerQuestion(input.message, input.plan, input.history);
    }
};
__decorate([
    Tool({
        name: 'analyze_floor_plan',
        description: 'Analyzes a floor plan image and returns the structured JSON floor plan data.',
        inputSchema: z.object({
            image_b64: z.string().describe('Base64 encoded string of the floor plan image (can include data URL prefix)'),
        }),
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], floorplanTools.prototype, "analyzeFloorPlan", null);
__decorate([
    Tool({
        name: 'estimate_cost',
        description: 'Generates a cost estimate based on a structured floor plan JSON.',
        inputSchema: z.object({
            plan: z.any().describe('The parsed floor plan JSON object'),
            location: z.string().default('US').describe('Geographic location for cost estimation'),
            quality: z.string().default('standard').describe('Quality level (basic, standard, premium)'),
        }),
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], floorplanTools.prototype, "estimateCost", null);
__decorate([
    Tool({
        name: 'chat',
        description: 'Sends a chat message to the 3D designer AI with the context of the floor plan.',
        inputSchema: z.object({
            message: z.string().describe('The message from the user'),
            plan: z.any().describe('The parsed floor plan JSON object'),
            history: z.array(z.any()).default([]).describe('The chat history array'),
        }),
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], floorplanTools.prototype, "chat", null);
floorplanTools = __decorate([
    Injectable()
], floorplanTools);
export { floorplanTools };
//# sourceMappingURL=floorplan.tools.js.map