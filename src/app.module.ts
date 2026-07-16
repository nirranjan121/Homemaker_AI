// src/app.module.ts
import { McpApp, Module, ConfigModule } from '@nitrostack/core';
import { HouseplanModule } from './modules/houseplan/houseplan.module.js';

@McpApp({
  module: AppModule,
  server: {
    name: 'homecraft-server',
    version: '0.1.0'
  }
})
@Module({
  imports: [
    ConfigModule.forRoot(),
    HouseplanModule
  ]
})
export class AppModule {}
