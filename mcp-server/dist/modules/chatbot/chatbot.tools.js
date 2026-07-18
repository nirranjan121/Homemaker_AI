var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a;
// src/modules/chatbot/chatbot.tools.ts
import { ToolDecorator as Tool, Widget, z, ControllerDecorator } from '@nitrostack/core';
import { HouseplanState } from '../houseplan/houseplan.state.js';
import { ChatbotAgent } from './agent/chatbot-agent.js';
let ChatbotTools = class ChatbotTools {
    houseplanState;
    chatbotAgent;
    constructor(houseplanState) {
        this.houseplanState = houseplanState;
        this.chatbotAgent = new ChatbotAgent(houseplanState);
    }
    async askChatbot(input, _ctx) {
        const model = this.houseplanState.has() ? this.houseplanState.get() : null;
        const response = await this.chatbotAgent.answerQuestion(input.question, input.chatHistory);
        return {
            planId: model?.planId,
            // Pass back all geometry and material states so the widget keeps rendering the model
            geometry: model?.rooms,
            materials: model?.materials,
            roomMaterials: model?.roomMaterials,
            // Chatbot specific response
            chatResponse: response.answer,
            suggestedQuery: response.suggestedQuery,
            // History returned so widget can render/append it
            chatHistory: [
                ...(input.chatHistory || []),
                { role: 'user', content: input.question },
                { role: 'model', content: response.answer }
            ]
        };
    }
};
__decorate([
    Tool({
        name: 'ask_chatbot',
        description: 'Answer questions and doubts from the client about the 3D house floor plan, ' +
            'including room specifications, total area, material choices, or estimated costs.',
        inputSchema: z.object({
            question: z.string().describe('The client\'s question or doubt.'),
            chatHistory: z.array(z.object({
                role: z.enum(['user', 'model', 'assistant']),
                content: z.string()
            })).optional().describe('Previous message history for conversation context.')
        })
    }),
    Widget('house-3d-viewer'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChatbotTools.prototype, "askChatbot", null);
ChatbotTools = __decorate([
    ControllerDecorator(),
    __metadata("design:paramtypes", [typeof (_a = typeof HouseplanState !== "undefined" && HouseplanState) === "function" ? _a : Object])
], ChatbotTools);
export { ChatbotTools };
//# sourceMappingURL=chatbot.tools.js.map