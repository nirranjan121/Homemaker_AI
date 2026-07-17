import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve('../.env') }); // Load GEMINI_API_KEY from env

import { ChatbotAgent } from './src/modules/chatbot/agent/chatbot-agent.js';
import { HouseplanState } from './src/modules/houseplan/houseplan.state.js';

const SQFT_PER_SQM = 10.764;

async function run() {


  const specPath = fs.existsSync(path.resolve('./uploads/3d_model_spec.json'))
    ? path.resolve('./uploads/3d_model_spec.json')
    : path.resolve('../uploads/3d_model_spec.json');
  if (!fs.existsSync(specPath)) {
    console.error(`Spec file not found at ${specPath}`);
    process.exit(1);
  }

  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

  // Parse input args
  const question = process.argv[2] || "Can you summarize the layout of the house?";
  const historyArg = process.argv[3] ? JSON.parse(process.argv[3]) : [];

  // Adapt the 3D Scene Spec format into the structure expected by the ChatbotAgent
  let totalAreaSqFt = 0;
  const rooms = (spec.rooms || []).map((r: any, idx: number) => {
    totalAreaSqFt += r.area_sq_ft || 0;
    const roomId = r.name.toLowerCase().replace(/\s+/g, '_') || `room_${idx}`;
    return {
      id: roomId,
      name: r.name,
      areaSqFt: r.area_sq_ft || 0,
      wallHeightM: spec.metadata?.default_wall_height_meters || 2.8,
      polygon: [
        { x: r.center?.x || 0, y: r.center?.z || 0 }
      ]
    };
  });

  const roomMaterials: Record<string, any> = {};
  (spec.rooms || []).forEach((r: any, idx: number) => {
    const roomId = r.name.toLowerCase().replace(/\s+/g, '_') || `room_${idx}`;
    roomMaterials[roomId] = {
      wallColor: r.wall_paint_color_hex || '#FFFFFF',
      wallTexture: 'flat',
      floorMaterial: r.floor_material?.type || 'concrete'
    };
  });

  const adaptedModel = {
    planId: "current_plan",
    totalFloorAreaSqM: totalAreaSqFt / SQFT_PER_SQM,
    rooms: rooms,
    roomMaterials: roomMaterials,
    materials: {}
  };

  // Setup a mock HouseplanState with our adapted model
  const mockState = new HouseplanState();
  mockState.set(adaptedModel as any);

  // Run the chatbot agent
  const agent = new ChatbotAgent(mockState);

  const apiKey = process.env.GEMINI_API_KEY || "";
  let answer = "";

  if (apiKey.startsWith("gsk_")) {
    const systemPrompt = (agent as any).buildSystemPrompt(adaptedModel);
    const messages = [
      { role: "system", content: systemPrompt }
    ];
    for (const h of historyArg) {
      messages.push({
        role: h.role === 'model' ? 'assistant' : h.role,
        content: h.content
      });
    }
    messages.push({ role: "user", content: question });

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: messages,
        temperature: 0.3,
        max_tokens: 1024
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Groq API returned error (${response.status}): ${errText}`);
    }

    const resJson = await response.json() as any;
    answer = resJson.choices[0].message.content.trim();
  } else {
    const response = await agent.answerQuestion(question, historyArg);
    answer = response.answer;
  }

  console.log(JSON.stringify({ answer: answer }));
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
