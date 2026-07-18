var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
// src/modules/chatbot/chatbot.module.ts
import { Module } from '@nitrostack/core';
import { ChatbotTools } from './chatbot.tools.js';
import { HouseplanModule } from '../houseplan/houseplan.module.js';
let ChatbotModule = class ChatbotModule {
};
ChatbotModule = __decorate([
    Module({
        name: 'ChatbotModule',
        imports: [HouseplanModule],
        controllers: [ChatbotTools]
    })
], ChatbotModule);
export { ChatbotModule };
//# sourceMappingURL=chatbot.module.js.map