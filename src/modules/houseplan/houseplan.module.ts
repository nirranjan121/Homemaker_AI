// src/modules/houseplan/houseplan.module.ts
import { Module } from '@nitrostack/core';
import { HouseplanTools } from './houseplan.tools.js';
import { HouseplanState } from './houseplan.state.js';

@Module({
  providers: [HouseplanTools, HouseplanState],
  exports: [HouseplanState]
})
export class HouseplanModule {}
