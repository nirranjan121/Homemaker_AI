import { ExecutionContext } from '@nitrostack/core';
import { HouseplanState } from '../houseplan/houseplan.state.js';
export declare class ChatbotTools {
    private readonly houseplanState;
    private readonly chatbotAgent;
    constructor(houseplanState: HouseplanState);
    askChatbot(input: {
        question: string;
        chatHistory?: {
            role: 'user' | 'model' | 'assistant';
            content: string;
        }[];
    }, _ctx: ExecutionContext): Promise<{
        planId: any;
        geometry: any;
        materials: any;
        roomMaterials: any;
        chatResponse: string;
        suggestedQuery: string | undefined;
        chatHistory: {
            role: string;
            content: string;
        }[];
    }>;
}
//# sourceMappingURL=chatbot.tools.d.ts.map