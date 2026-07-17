// src/modules/chatbot/agent/chatbot-agent.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import { HouseplanState } from '../../houseplan/houseplan.state.js';

export class ChatbotAgent {
  private genAI: GoogleGenerativeAI | null = null;

  constructor(private readonly state: HouseplanState) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
  }

  async answerQuestion(
    question: string,
    history?: { role: 'user' | 'model' | 'assistant'; content: string }[]
  ): Promise<{ answer: string; suggestedQuery?: string }> {
    const model = this.state.has() ? this.state.get() : null;

    if (this.genAI) {
      try {
        return await this.answerWithGemini(question, model, history);
      } catch (err) {
        console.error('Gemini chatbot call failed, falling back to rule-based chatbot:', err);
      }
    }

    return this.answerWithRules(question, model);
  }

  private async answerWithGemini(
    question: string,
    model: any,
    history?: any[]
  ): Promise<{ answer: string; suggestedQuery?: string }> {
    const systemPrompt = this.buildSystemPrompt(model);
    
    // Fall back to 2.0-flash as configured in the design agent
    const geminiModel = this.genAI!.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
      },
    });

    const formattedContents = (history || []).map(h => ({
      role: h.role === 'assistant' ? 'model' : h.role,
      parts: [{ text: h.content }]
    }));
    formattedContents.push({ role: 'user', parts: [{ text: question }] });

    const result = await geminiModel.generateContent({
      contents: formattedContents,
      systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
    });

    return { answer: result.response.text().trim() };
  }

  private buildSystemPrompt(model: any): string {
    const modelContext = model
      ? `
- Total Floor Area: ${Math.round(model.totalFloorAreaSqM * 10.764)} sq ft (${Math.round(model.totalFloorAreaSqM)} sq m)
- Rooms count: ${model.rooms.length}
- Rooms list:
${model.rooms.map((r: any) => `  - Room ID: "${r.id}" (Display Name: "${r.name}"), Wall Height: ${r.wallHeightM}m, Outline coordinates: ${JSON.stringify(r.polygon)}`).join('\n')}
- Current surface materials assigned to rooms:
${JSON.stringify(model.roomMaterials, null, 2)}
`
      : 'No floor plan has been uploaded yet. The client must first upload a 2D floor plan image using `generate_3d_shell`.';

    return `You are a helpful, professional interior design and construction AI chatbot assistant.
The client is visualizing their house floor plan in 3D and has questions or doubts about it.

# CURRENT HOUSE LAYOUT AND STATE:
${modelContext}

# INSTRUCTIONS:
1. Answer the client's questions accurately and professionally based on the current layout and state above.
2. If they ask about dimensions, room sizes, or locations, refer to the room list or coordinates.
3. If they ask about materials, wall colors, or options, refer to the current assignments.
4. If they ask about estimated construction costs, explain that they can run the \`estimate_cost\` tool to get a precise regional estimation, but you can also provide general cost bands if they mention a city/tier (e.g. Metro is ₹2500-₹3500/sqft, Tier 2 is ₹2000-₹2800/sqft, Tier 3 is ₹1700-₹2300/sqft for standard quality).
5. If the client asks to change the design, colors, or textures (e.g. "make the bedroom walls green"), politely explain: "I can help guide you! Since I am the chatbot, you can directly ask the design agent tool (\`design_modify\`) or command me to edit it and I'll suggest running that tool for you."
6. Keep answers concise, clear, and easy to read. Use bullet points or markdown where appropriate. Be friendly and collaborative.`;
  }

  private answerWithRules(question: string, model: any): { answer: string } {
    const lower = question.toLowerCase();
    if (!model) {
      return { answer: 'No floor plan has been uploaded yet. Please call `generate_3d_shell` with a floor plan image first.' };
    }

    if (lower.includes('area') || lower.includes('size') || lower.includes('square')) {
      const areaSqft = Math.round(model.totalFloorAreaSqM * 10.764);
      return { answer: `The total floor area of the house is approximately ${model.totalFloorAreaSqM.toFixed(1)} sq meters (${areaSqft} sq feet).` };
    }

    if (lower.includes('room') || lower.includes('layout')) {
      const roomList = model.rooms.map((r: any) => r.name).join(', ');
      return { answer: `The house currently has ${model.rooms.length} rooms: ${roomList}.` };
    }

    if (lower.includes('material') || lower.includes('color') || lower.includes('paint') || lower.includes('floor')) {
      let details = 'Here are the current materials:\n';
      for (const room of model.rooms) {
        const mat = model.roomMaterials[room.id] || { wallColor: 'Default', wallTexture: 'flat', floorMaterial: 'concrete' };
        details += `- **${room.name}**: Wall paint: \`${mat.wallColor}\`, Wall texture: \`${mat.wallTexture}\`, Floor: \`${mat.floorMaterial}\`\n`;
      }
      return { answer: details };
    }

    if (lower.includes('cost') || lower.includes('estimate') || lower.includes('price')) {
      return { answer: 'To get a construction cost estimate, please provide your city and run the `estimate_cost` tool. Metro areas range from ₹2,500 to ₹3,500 per sq ft for standard quality.' };
    }

    return {
      answer: `I am here to help you understand your floor plan and design choices! You can ask me about:
- Room layouts and dimensions (e.g., "What rooms do we have?")
- Applied colors and materials (e.g., "What is the floor material in the living room?")
- Floor area and sizes (e.g., "How large is the house?")
- General construction cost queries.
(Note: Set \`GEMINI_API_KEY\` in your .env for rich, natural conversations!)`
    };
  }
}
