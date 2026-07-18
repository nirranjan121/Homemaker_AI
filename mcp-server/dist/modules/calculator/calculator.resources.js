var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { ResourceDecorator as Resource } from '@nitrostack/core';
export class CalculatorResources {
    async getOperations(uri, ctx) {
        ctx.logger.info('Fetching calculator operations');
        const operations = [
            {
                name: 'add',
                symbol: '+',
                description: 'Addition',
                example: '5 + 3 = 8'
            },
            {
                name: 'subtract',
                symbol: '-',
                description: 'Subtraction',
                example: '10 - 4 = 6'
            },
            {
                name: 'multiply',
                symbol: '×',
                description: 'Multiplication',
                example: '6 × 7 = 42'
            },
            {
                name: 'divide',
                symbol: '÷',
                description: 'Division',
                example: '20 ÷ 5 = 4'
            }
        ];
        return {
            contents: [{
                    uri,
                    mimeType: 'application/json',
                    text: JSON.stringify({ operations }, null, 2)
                }]
        };
    }
}
__decorate([
    Resource({
        uri: 'calculator://operations',
        name: 'Calculator Operations',
        description: 'List of available calculator operations',
        mimeType: 'application/json',
        examples: {
            response: {
                operations: [
                    { name: 'add', symbol: '+', description: 'Addition' },
                    { name: 'subtract', symbol: '-', description: 'Subtraction' },
                    { name: 'multiply', symbol: '×', description: 'Multiplication' },
                    { name: 'divide', symbol: '÷', description: 'Division' }
                ]
            }
        }
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], CalculatorResources.prototype, "getOperations", null);
//# sourceMappingURL=calculator.resources.js.map