import { ExecutionContext } from '@nitrostack/core';
/**
 * Floorplan Tools
 * Exposes the Python backend capabilities to the MCP framework.
 */
export declare class floorplanTools {
    analyzeFloorPlan(input: {
        image_b64: string;
        width: number;
        height: number;
        mime_type: string;
    }, context: ExecutionContext): Promise<unknown>;
    estimateCost(input: {
        plan: any;
        location: string;
        quality: string;
    }, context: ExecutionContext): Promise<unknown>;
    chat(input: {
        message: string;
        plan: any;
        history: any[];
    }, context: ExecutionContext): Promise<unknown>;
}
//# sourceMappingURL=floorplan.tools.d.ts.map