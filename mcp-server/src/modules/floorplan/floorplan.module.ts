import { Module } from '@nitrostack/core';
import { floorplanTools } from './floorplan.tools.js';
import { floorplanResources } from './floorplan.resources.js';
import { floorplanPrompts } from './floorplan.prompts.js';

@Module({
  name: 'floorplan',
  description: 'TODO: Add description',
  controllers: [floorplanTools, floorplanResources, floorplanPrompts],
})
export class floorplanModule {}
