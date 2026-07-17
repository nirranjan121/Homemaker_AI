import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { RoomShape, FloorMaterial } from '../../../modules/houseplan/houseplan.types';

const FLOOR_COLORS: Record<FloorMaterial, number> = {
  oak: 0xc9a66b,
  tile: 0xe8e4dc,
  concrete: 0x9b9b93,
  carpet: 0x6e6a63,
};

const WALL_THICKNESS_M = 0.15;

export interface SceneHandle {
  setWallColor: (hex: string) => void;
  setFloorMaterial: (roomId: string, material: FloorMaterial) => void;
  dispose: () => void;
}

/**
 * Builds the extruded shell: one flat floor mesh per room (colored by its
 * material) and a box per polygon edge for walls. Geometry-changing edits
 * ("make the kitchen bigger") are out of scope — see README, not built.
 * This only supports swapping wall color / floor material on the fixed
 * room polygons it's given.
 */
export function buildHouseScene(
  container: HTMLElement,
  rooms: RoomShape[],
  initial: { wallColorHex: string; floorMaterials: Record<string, FloorMaterial> },
): SceneHandle {
  const width = container.clientWidth || 640;
  const height = container.clientHeight || 480;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf5f4f0);

  const center = polygonsCenter(rooms);
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 200);
  camera.position.set(center.x + 10, 10, center.z + 10);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(center.x, 0, center.z);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI / 2.05;
  controls.update();

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(center.x + 10, 15, center.z + 8);
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({ color: 0xe4e2da }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(center.x, -0.01, center.z);
  scene.add(ground);

  const roomGroup = new THREE.Group();
  scene.add(roomGroup);

  const wallColor = new THREE.Color(initial.wallColorHex);
  const wallMaterial = new THREE.MeshStandardMaterial({ color: wallColor });
  const floorMaterialByRoom: Record<string, FloorMaterial> = { ...initial.floorMaterials };
  const floorMeshByRoom = new Map<string, THREE.Mesh>();

  for (const room of rooms) {
    const shape = new THREE.Shape(room.polygon.map(([x, z]) => new THREE.Vector2(x, z)));
    const floorMesh = new THREE.Mesh(
      new THREE.ShapeGeometry(shape),
      new THREE.MeshStandardMaterial({
        color: FLOOR_COLORS[floorMaterialByRoom[room.id] ?? 'oak'],
        side: THREE.DoubleSide,
      }),
    );
    floorMesh.rotation.x = -Math.PI / 2;
    roomGroup.add(floorMesh);
    floorMeshByRoom.set(room.id, floorMesh);

    const pts = room.polygon;
    for (let i = 0; i < pts.length; i++) {
      const [x1, z1] = pts[i];
      const [x2, z2] = pts[(i + 1) % pts.length];
      const dx = x2 - x1;
      const dz = z2 - z1;
      const length = Math.hypot(dx, dz);
      if (length < 1e-6) continue;

      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(length, room.wallHeightM, WALL_THICKNESS_M),
        wallMaterial,
      );
      wall.position.set((x1 + x2) / 2, room.wallHeightM / 2, (z1 + z2) / 2);
      wall.rotation.y = -Math.atan2(dz, dx);
      roomGroup.add(wall);
    }
  }

  let raf = 0;
  const animate = () => {
    controls.update();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(animate);
  };
  animate();

  const onResize = () => {
    const w = container.clientWidth || 640;
    const h = container.clientHeight || 480;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener('resize', onResize);

  return {
    setWallColor(hex) {
      wallMaterial.color.set(hex);
    },
    setFloorMaterial(roomId, material) {
      floorMaterialByRoom[roomId] = material;
      const mesh = floorMeshByRoom.get(roomId);
      if (mesh) {
        (mesh.material as THREE.MeshStandardMaterial).color.setHex(FLOOR_COLORS[material]);
      }
    },
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

function polygonsCenter(rooms: RoomShape[]): { x: number; z: number } {
  let sx = 0;
  let sz = 0;
  let n = 0;
  for (const room of rooms) {
    for (const [x, z] of room.polygon) {
      sx += x;
      sz += z;
      n++;
    }
  }
  return n === 0 ? { x: 0, z: 0 } : { x: sx / n, z: sz / n };
}
