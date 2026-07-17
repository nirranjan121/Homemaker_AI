// src/modules/houseplan/houseplan.state.ts

export interface RoomShape {
  id: string;
  name: string; // e.g. "living_room", "kitchen", "bedroom_1"
  // polygon in plan units (meters), one room = one closed polygon
  polygon: { x: number; y: number }[];
  wallHeightM: number;
}

/** Per-room surface material state. */
export interface RoomMaterials {
  wallColor: string;       // hex color
  wallColorId?: string;    // catalog ID (e.g. "sage_green")
  wallTexture: string;     // catalog ID (e.g. "red_brick", "smooth_plaster")
  floorMaterial: string;   // catalog ID (e.g. "oak_hardwood")
  floorColor?: string;     // resolved hex color for the floor
}

export interface HouseModel {
  planId: string;
  rooms: RoomShape[];
  totalFloorAreaSqM: number;
  /** Per-room material assignments. Key = roomId. */
  roomMaterials: Record<string, RoomMaterials>;
  /** Legacy global materials — kept for backward compat with existing tools. */
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
  /** Snapshots of roomMaterials for undo support. */
  history?: Record<string, RoomMaterials>[];
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

  /**
   * Undo the last design_modify change.
   * Returns true if there was something to undo.
   */
  undo(): boolean {
    if (!this.current || !this.current.history || this.current.history.length === 0) {
      return false;
    }
    this.current.roomMaterials = this.current.history.pop()!;
    return true;
  }
}
