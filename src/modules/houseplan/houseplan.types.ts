export interface RoomShape {
  id: string;
  name: string;
  /** Footprint outline in meters, ordered clockwise, one polygon per room. */
  polygon: [number, number][];
  wallHeightM: number;
}

export type FloorMaterial = 'oak' | 'tile' | 'concrete' | 'carpet';

export interface HouseModel {
  rooms: RoomShape[];
  wallColorHex: string;
  floorMaterials: Record<string, FloorMaterial>;
}

export interface CostEstimate {
  areaSqft: number;
  minInr: number;
  maxInr: number;
  rateTier: string;
}
