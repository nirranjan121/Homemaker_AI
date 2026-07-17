// src/modules/chatbot/chatbot.module.ts
import { Module } from '@nitrostack/core';
import { ChatbotTools } from './chatbot.tools.js';
import { HouseplanModule } from '../houseplan/houseplan.module.js';

@Module({
  name: 'ChatbotModule',
  imports: [HouseplanModule],
  controllers: [ChatbotTools]
})
export class ChatbotModule {}
