var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { PromptDecorator as Prompt } from '@nitrostack/core';
export class CalculatorPrompts {
    async getHelp(args, ctx) {
        ctx.logger.info('Generating calculator help prompt');
        const operation = args.operation;
        if (operation) {
            // Help for specific operation
            const helpText = this.getOperationHelp(operation);
            return [
                {
                    role: 'user',
                    content: `How do I use the ${operation} operation in the calculator?`
                },
                {
                    role: 'assistant',
                    content: helpText
                }
            ];
        }
        // General help
        return [
            {
                role: 'user',
                content: 'How do I use the calculator?'
            },
            {
                role: 'assistant',
                content: `The calculator supports four basic operations:

1. **Addition** - Add two numbers together
   Example: calculate(operation="add", a=5, b=3) = 8

2. **Subtraction** - Subtract one number from another
   Example: calculate(operation="subtract", a=10, b=4) = 6

3. **Multiplication** - Multiply two numbers
   Example: calculate(operation="multiply", a=6, b=7) = 42

4. **Division** - Divide one number by another
   Example: calculate(operation="divide", a=20, b=5) = 4

Just call the 'calculate' tool with the operation and two numbers!`
            }
        ];
    }
    getOperationHelp(operation) {
        const helps = {
            add: 'Use addition to sum two numbers. Call calculate(operation="add", a=5, b=3) to get 8.',
            subtract: 'Use subtraction to find the difference. Call calculate(operation="subtract", a=10, b=4) to get 6.',
            multiply: 'Use multiplication to find the product. Call calculate(operation="multiply", a=6, b=7) to get 42.',
            divide: 'Use division to find the quotient. Call calculate(operation="divide", a=20, b=5) to get 4. Note: Cannot divide by zero!'
        };
        return helps[operation] || 'Unknown operation. Available operations: add, subtract, multiply, divide.';
    }
}
__decorate([
    Prompt({
        name: 'calculator_help',
        description: 'Get help with calculator operations',
        arguments: [
            {
                name: 'operation',
                description: 'The operation to get help with (optional)',
                required: false
            }
        ]
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CalculatorPrompts.prototype, "getHelp", null);
//# sourceMappingURL=calculator.prompts.js.map