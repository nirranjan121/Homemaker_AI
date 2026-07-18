import { ExecutionContext } from '@nitrostack/core';
/**
 * floorplan Prompts
 *
 * TODO: Add description
 */
export declare class floorplanPrompts {
    helpPrompt(args: Record<string, unknown>, context: ExecutionContext): Promise<{
        role: "user";
        content: {
            type: "text";
            text: string;
        };
    }[]>;
}
//# sourceMappingURL=floorplan.prompts.d.ts.map