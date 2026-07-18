import { ExecutionContext } from '@nitrostack/core';
export declare class CalculatorTools {
    calculate(input: any, ctx: ExecutionContext): Promise<{
        operation: any;
        a: any;
        b: any;
        result: number;
        expression: string;
    }>;
    convertTemperature(input: any, ctx: ExecutionContext): Promise<{
        status: string;
        message: string;
        file_info: {
            name: any;
            type: any;
            saved_path: string;
            status: string;
        };
        conversion_result: {
            value: number;
            unit: any;
        } | null;
        original_value: {
            value: any;
            unit: any;
        } | null;
    }>;
}
//# sourceMappingURL=calculator.tools.d.ts.map