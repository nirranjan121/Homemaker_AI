import { ExecutionContext } from '@nitrostack/core';
export declare class CalculatorResources {
    getOperations(uri: string, ctx: ExecutionContext): Promise<{
        contents: {
            uri: string;
            mimeType: string;
            text: string;
        }[];
    }>;
}
//# sourceMappingURL=calculator.resources.d.ts.map