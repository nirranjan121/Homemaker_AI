// src/modules/chatbot/agent/chatbot-agent.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import { HouseplanState } from '../../houseplan/houseplan.state.js';
import * as fs from 'fs';
import * as path from 'path';

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
    // 1. Load cost estimate if it exists
    let costContext = "No cost estimate has been calculated yet. The client can calculate it by specifying a location and quality in the Cost Estimator sidebar panel.";
    try {
      const costReportPath = path.resolve(process.cwd(), 'uploads/cost_estimate_report.json');
      if (fs.existsSync(costReportPath)) {
        const costData = JSON.parse(fs.readFileSync(costReportPath, 'utf8'));
        costContext = `
- Location: ${costData.location?.locality ? costData.location.locality + ', ' : ''}${costData.location?.city || 'Bengaluru'} (${costData.location?.tier?.toUpperCase() || 'METRO'} market)
- Total Project/Construction Cost Range: ₹${(costData.total_project_cost?.low || costData.totalProjectCost?.low || 0).toLocaleString('en-IN')} to ₹${(costData.total_project_cost?.high || costData.totalProjectCost?.high || 0).toLocaleString('en-IN')}
- Material Cost Total: ₹${(costData.total_material_cost || costData.totalMaterialCost || 0).toLocaleString('en-IN')}
- Itemized Material Breakdown:
${((costData.material_breakdown || costData.materialBreakdown || [])).map((m: any) => `  - ${m.item}: Quantity=${m.quantity} ${m.unit}, Unit Price=₹${m.unit_price_inr || m.unitPriceInr}, Total=₹${(m.total_inr || m.totalInr).toLocaleString('en-IN')}`).join('\n')}
- Rates Used:
  - Construction rate: ₹${costData.rates_used?.constructionRateInrPerSqft?.low || costData.rates?.constructionRateInrPerSqft?.low || 0} - ₹${costData.rates_used?.constructionRateInrPerSqft?.high || costData.rates?.constructionRateInrPerSqft?.high || 0} per sqft
  - Cement: ₹${costData.rates_used?.materialPrices?.cementInrPerBag || costData.rates?.materialPrices?.cementInrPerBag || 0}/bag
  - Steel: ₹${costData.rates_used?.materialPrices?.steelInrPerKg || costData.rates?.materialPrices?.steelInrPerKg || 0}/kg
  - Sand: ₹${costData.rates_used?.materialPrices?.sandInrPerCft || costData.rates?.materialPrices?.sandInrPerCft || 0}/cft
  - Aggregate: ₹${costData.rates_used?.materialPrices?.aggregateInrPerCft || costData.rates?.materialPrices?.aggregateInrPerCft || 0}/cft
  - Bricks: ₹${costData.rates_used?.materialPrices?.brickInrPerThousand || costData.rates?.materialPrices?.brickInrPerThousand || 0}/thousand
  - Paint: ₹${costData.rates_used?.materialPrices?.paintInrPerLitre || costData.rates?.materialPrices?.paintInrPerLitre || 0}/L
  - Tiles: ₹${costData.rates_used?.materialPrices?.tilesInrPerSqft || costData.rates?.materialPrices?.tilesInrPerSqft || 0}/sqft
`;
      }
    } catch (e) {
      console.warn("Could not read cost report inside agent:", e);
    }

    const modelContext = model
      ? `
- Total Floor Area: ${Math.round(model.totalFloorAreaSqM * 10.764)} sq ft (${Math.round(model.totalFloorAreaSqM)} sq m)
- Rooms count: ${model.rooms.length}
- Rooms list:
${model.rooms.map((r: any) => `  - Room ID: "${r.id}" (Display Name: "${r.name}"), Area: ${r.areaSqFt || Math.round(r.polygon ? (r.polygon.length > 2 ? 100 : 0) : 0)} sq ft, Wall Height: ${r.wallHeightM}m`).join('\n')}
- Current surface materials assigned to rooms:
${JSON.stringify(model.roomMaterials, null, 2)}
`
      : 'No floor plan has been uploaded yet. The client must first upload a 2D floor plan image using `generate_3d_shell`.';

    return `You are a helpful, professional interior design, architecture, and construction AI chatbot assistant.
The client is visualizing their house floor plan in 3D and has questions or doubts about its layout, rooms, dimensions, building materials, and costs.

# CURRENT HOUSE LAYOUT AND STATE:
${modelContext}

# CURRENT COST ESTIMATE DETAILS:
${costContext}

# INSTRUCTIONS:
1. Answer the client's questions accurately and professionally.
2. If they ask about dimensions, room sizes, or locations, refer to the room list or coordinates.
3. If they ask about estimated construction costs, cement bags, steel tonnage, or materials: refer to the "CURRENT COST ESTIMATE DETAILS" section above. Provide the exact calculated cost ranges and itemized materials from the report if it is calculated.
4. If they have doubts or look for ALTERNATE materials (e.g. wood vs tiles, marble vs vitrified tiles, brick walls vs AAC blocks, concrete vs drywall), provide expert suggestions:
   - Detail the pros/cons (durability, maintenance, comfort, thermal insulation).
   - Give relative cost impacts (e.g. "Choosing marble instead of vitrified tiles will increase flooring cost by about 2-3x", or "Drywall partitions are cheaper and faster but have lower soundproofing than brick").
   - Help them make informed choices.
5. Keep answers clear, engaging, and well-formatted with markdown and bullet points. Be friendly, collaborative, and professional.`;
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
