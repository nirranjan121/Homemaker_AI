// src/modules/houseplan/houseplan.module.ts
import { Module } from '@nitrostack/core';
import { HouseplanTools } from './houseplan.tools.js';
import { HouseplanState } from './houseplan.state.js';

@Module({
  name: 'HouseplanModule',
  controllers: [HouseplanTools],
  providers: [HouseplanState],
  exports: [HouseplanState]
})
export class HouseplanModule {}
