export declare class ChatbotAgent {
    private genAI;
    constructor();
    answerQuestion(question: string, model: any, history?: {
        role: 'user' | 'model' | 'assistant';
        content: string;
    }[]): Promise<{
        answer: string;
        suggestedQuery?: string;
    }>;
    private answerWithGemini;
    private buildSystemPrompt;
    private answerWithRules;
}
//# sourceMappingURL=chatbot-agent.d.ts.map