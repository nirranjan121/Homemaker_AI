// src/modules/houseplan/houseplan.vision.ts
import { RoomShape } from './houseplan.state.js';

/**
 * STUB. Replace with a real floor-plan segmentation pipeline:
 *   - room/wall segmentation model (e.g. a U-Net or similar trained on
 *     a floor-plan dataset such as CubiCasa5K), OR
 *   - a simpler OpenCV heuristic pipeline (line detection + closed-contour
 *     extraction) for the hackathon MVP.
 *
 * For the demo, this returns a fixed, reasonable-looking 3-room layout so the
 * rest of the pipeline (3D shell generation, widget rendering, cost estimate)
 * can be built and demoed independently of the segmentation model actually
 * being finished. Wire in the real extractor here when ready — the return
 * shape (RoomShape[]) is the contract the rest of the app depends on.
 */
export async function extractRoomsFromPlanImage(
  _imageBase64: string
): Promise<RoomShape[]> {
  return [
    {
      id: 'living_room',
      name: 'Living Room',
      polygon: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 4 },
        { x: 0, y: 4 }
      ],
      wallHeightM: 3
    },
    {
      id: 'kitchen',
      name: 'Kitchen',
      polygon: [
        { x: 5, y: 0 },
        { x: 8, y: 0 },
        { x: 8, y: 4 },
        { x: 5, y: 4 }
      ],
      wallHeightM: 3
    },
    {
      id: 'bedroom_1',
      name: 'Bedroom 1',
      polygon: [
        { x: 0, y: 4 },
        { x: 4, y: 4 },
        { x: 4, y: 8 },
        { x: 0, y: 8 }
      ],
      wallHeightM: 3
    }
  ];
}

export function shoelaceAreaSqM(polygon: { x: number; y: number }[]): number {
  let area = 0;
  for (let i = 0; i < polygon.length; i++) {
    const { x: x1, y: y1 } = polygon[i];
    const { x: x2, y: y2 } = polygon[(i + 1) % polygon.length];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}
