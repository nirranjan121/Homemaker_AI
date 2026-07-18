var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from '@nitrostack/core';
import { floorplanTools } from './floorplan.tools.js';
import { floorplanResources } from './floorplan.resources.js';
import { floorplanPrompts } from './floorplan.prompts.js';
let floorplanModule = class floorplanModule {
};
floorplanModule = __decorate([
    Module({
        name: 'floorplan',
        description: 'TODO: Add description',
        controllers: [floorplanTools, floorplanResources, floorplanPrompts],
    })
], floorplanModule);
export { floorplanModule };
//# sourceMappingURL=floorplan.module.js.map