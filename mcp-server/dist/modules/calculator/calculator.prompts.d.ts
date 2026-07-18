import { ExecutionContext } from '@nitrostack/core';
export declare class CalculatorPrompts {
    getHelp(args: any, ctx: ExecutionContext): Promise<({
        role: "user";
        content: string;
    } | {
        role: "assistant";
        content: string;
    })[]>;
    private getOperationHelp;
}
//# sourceMappingURL=calculator.prompts.d.ts.map