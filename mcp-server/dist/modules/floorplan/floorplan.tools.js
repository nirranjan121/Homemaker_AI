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
const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://127.0.0.1:8000/api';
/**
 * Floorplan Tools
 * Exposes the Python backend capabilities to the MCP framework.
 */
let floorplanTools = class floorplanTools {
    async analyzeFloorPlan(input, context) {
        context.logger.info(`Sending analyze request to ${PYTHON_API_URL}/analyze`);
        const res = await fetch(`${PYTHON_API_URL}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });
        if (!res.ok) {
            throw new Error(`Python API Error: ${res.statusText}`);
        }
        return await res.json();
    }
    async estimateCost(input, context) {
        context.logger.info(`Sending estimate-cost request to ${PYTHON_API_URL}/estimate-cost`);
        const res = await fetch(`${PYTHON_API_URL}/estimate-cost`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });
        if (!res.ok) {
            throw new Error(`Python API Error: ${res.statusText}`);
        }
        return await res.json();
    }
    async chat(input, context) {
        context.logger.info(`Sending chat request to ${PYTHON_API_URL}/chat`);
        const res = await fetch(`${PYTHON_API_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });
        if (!res.ok) {
            throw new Error(`Python API Error: ${res.statusText}`);
        }
        return await res.json();
    }
};
__decorate([
    Tool({
        name: 'analyze_floor_plan',
        description: 'Analyzes a floor plan image and returns the structured JSON floor plan data.',
        inputSchema: z.object({
            image_b64: z.string().describe('Base64 encoded string of the floor plan image'),
            width: z.number().describe('Width of the image in pixels'),
            height: z.number().describe('Height of the image in pixels'),
            mime_type: z.string().default('image/jpeg').describe('MIME type of the image'),
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
            quality: z.string().default('standard').describe('Quality level (budget, standard, luxury)'),
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