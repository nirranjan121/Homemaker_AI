// src/app.module.ts
import { McpApp, Module, ConfigModule } from '@nitrostack/core';
import { HouseplanModule } from './modules/houseplan/houseplan.module.js';
import { ChatbotModule } from './modules/chatbot/chatbot.module.js';

@Module({
  name: 'AppModule',
  imports: [
    ConfigModule.forRoot(),
    HouseplanModule,
    ChatbotModule
  ],
  providers: [
    { provide: 'OAUTH_CONFIG', useValue: { required: false } }
  ]
})
export class AppModule {}

McpApp({
  module: AppModule,
  server: {
    name: 'homecraft-server',
    version: '0.1.0'
  }
})(AppModule);
