import { ToolDecorator as Tool, z, ExecutionContext, Injectable } from '@nitrostack/core';

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://127.0.0.1:8000/api';

/**
 * Floorplan Tools
 * Exposes the Python backend capabilities to the MCP framework.
 */
@Injectable()
export class floorplanTools {
  @Tool({
    name: 'analyze_floor_plan',
    description: 'Analyzes a floor plan image and returns the structured JSON floor plan data.',
    inputSchema: z.object({
      image_b64: z.string().describe('Base64 encoded string of the floor plan image'),
      width: z.number().describe('Width of the image in pixels'),
      height: z.number().describe('Height of the image in pixels'),
      mime_type: z.string().default('image/jpeg').describe('MIME type of the image'),
    }),
  })
  async analyzeFloorPlan(input: { image_b64: string; width: number; height: number; mime_type: string }, context: ExecutionContext) {
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

  @Tool({
    name: 'estimate_cost',
    description: 'Generates a cost estimate based on a structured floor plan JSON.',
    inputSchema: z.object({
      plan: z.any().describe('The parsed floor plan JSON object'),
      location: z.string().default('US').describe('Geographic location for cost estimation'),
      quality: z.string().default('standard').describe('Quality level (budget, standard, luxury)'),
    }),
  })
  async estimateCost(input: { plan: any; location: string; quality: string }, context: ExecutionContext) {
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

  @Tool({
    name: 'chat',
    description: 'Sends a chat message to the 3D designer AI with the context of the floor plan.',
    inputSchema: z.object({
      message: z.string().describe('The message from the user'),
      plan: z.any().describe('The parsed floor plan JSON object'),
      history: z.array(z.any()).default([]).describe('The chat history array'),
    }),
  })
  async chat(input: { message: string; plan: any; history: any[] }, context: ExecutionContext) {
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
}
