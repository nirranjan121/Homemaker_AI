// src/modules/chatbot/chatbot.tools.ts
import { ToolDecorator as Tool, Widget, z, ExecutionContext, ControllerDecorator } from '@nitrostack/core';
import { HouseplanState } from '../houseplan/houseplan.state.js';
import { ChatbotAgent } from './agent/chatbot-agent.js';

@ControllerDecorator()
export class ChatbotTools {
  private readonly chatbotAgent: ChatbotAgent;

  constructor(private readonly houseplanState: HouseplanState) {
    this.chatbotAgent = new ChatbotAgent(houseplanState);
  }

  @Tool({
    name: 'ask_chatbot',
    description:
      'Answer questions and doubts from the client about the 3D house floor plan, ' +
      'including room specifications, total area, material choices, or estimated costs.',
    inputSchema: z.object({
      question: z.string().describe('The client\'s question or doubt.'),
      chatHistory: z.array(z.object({
        role: z.enum(['user', 'model', 'assistant']),
        content: z.string()
      })).optional().describe('Previous message history for conversation context.')
    })
  })
  @Widget('house-3d-viewer')
  async askChatbot(
    input: { question: string; chatHistory?: { role: 'user' | 'model' | 'assistant'; content: string }[] },
    _ctx: ExecutionContext
  ) {
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
}
