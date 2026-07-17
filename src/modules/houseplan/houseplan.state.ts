// src/modules/houseplan/houseplan.state.ts

export interface RoomShape {
  id: string;
  name: string; // e.g. "living_room", "kitchen", "bedroom_1"
  // polygon in plan units (meters), one room = one closed polygon
  polygon: { x: number; y: number }[];
  wallHeightM: number;
}

export interface HouseModel {
  planId: string;
  rooms: RoomShape[];
  totalFloorAreaSqM: number;
  materials: {
    wallColor: string;
    floorMaterial: string;
  };
  location?: {
    query: string;
    lat?: number;
    lng?: number;
    resolvedCity?: string;
  };
}

/**
 * In-memory store for the single active session's house model.
 * Swap for Supabase/Firebase per-session storage once this needs to be multi-user.
 */
export class HouseplanState {
  private current: HouseModel | null = null;

  set(model: HouseModel) {
    this.current = model;
  }

  get(): HouseModel {
    if (!this.current) {
      throw new Error(
        'No house model yet. Call generate_3d_shell first with a floor plan image.'
      );
    }
    return this.current;
  }

  has(): boolean {
    return this.current !== null;
  }
}
