import { ExecutionContext } from '@nitrostack/core';
export declare class floorplanTools {
    analyzeFloorPlan(input: {
        image_b64: string;
    }, context: ExecutionContext): Promise<{
        plan: any;
        processed_image: string;
    }>;
    estimateCost(input: {
        plan: any;
        location: string;
        quality: string;
    }, context: ExecutionContext): Promise<{
        location: import("../costestimator/costestimator.types.js").LocationInfo;
        inputs: {
            houseAreaSqFt: number;
            floors: number;
            quality: "basic" | "standard" | "premium";
            currency: string;
        };
        constructionCost: {
            low: number;
            high: number;
            mid: number;
        };
        materialBreakdown: import("../costestimator/costestimator.types.js").MaterialBreakdown[];
        totalMaterialCost: number;
        rates: import("../costestimator/costestimator.types.js").LiveRates;
        fetchedAt: string;
    }>;
    chat(input: {
        message: string;
        plan: any;
        history: any[];
    }, context: ExecutionContext): Promise<{
        answer: string;
        suggestedQuery?: string;
    }>;
}
//# sourceMappingURL=floorplan.tools.d.ts.map