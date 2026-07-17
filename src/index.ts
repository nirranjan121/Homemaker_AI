import 'reflect-metadata';
import { McpApplicationFactory } from '@nitrostack/core';
import { AppModule } from './app.module.js';

// Set widgets dev mode to true in development to skip looking for static HTML builds on disk
if (process.env.NODE_ENV !== 'production') {
  process.env.WIDGETS_DEV_MODE = 'true';
}

async function bootstrap() {
  try {
    console.log("Starting HomeCraft...");
    const app = await McpApplicationFactory.create(AppModule);
    await app.start();
  } catch (error) {
    console.error("Failed to start HomeCraft:", error);
    process.exit(1);
  }
}

bootstrap();
