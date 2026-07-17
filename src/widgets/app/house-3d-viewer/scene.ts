import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// ── Types (local to widget — avoids import path issues) ──────────────

interface RoomShape {
  id: string;
  name: string;
  polygon: { x: number; y: number }[];
  wallHeightM: number;
}

interface RoomMaterials {
  wallColor: string;
  wallColorId?: string;
  wallTexture: string;
  floorMaterial: string;
  floorColor?: string;
}

// ── Texture type → color mapping (for procedural textures) ──────────

const TEXTURE_COLORS: Record<string, number> = {
  flat: 0xf2f0ea,
  brick: 0x8B4513,
  stone: 0x8B8680,
  wood_panel: 0xDEB887,
  concrete: 0x9B9B93,
  plaster: 0xF2EDE4,
  marble: 0xF5F5F0,
  granite: 0x808080,
  ceramic: 0xF0F0F0,
  hardwood: 0xC9A66B,
  carpet: 0x808080,
  vinyl: 0xB8956A,
};

const WALL_THICKNESS_M = 0.15;

export interface SceneHandle {
  setWallColor: (hex: string, roomId?: string) => void;
  setWallTexture: (roomId: string, textureType: string, colorHex: string) => void;
  setFloorMaterial: (roomId: string, materialId: string, colorHex: string) => void;
  updateAllRoomMaterials: (roomMaterials: Record<string, RoomMaterials>) => void;
  dispose: () => void;
}

/**
 * Generates a procedural canvas texture for different material types.
 * This avoids needing external image files — everything is generated at runtime.
 */
function generateProceduralTexture(
  textureType: string,
  baseColor: string,
  size: number = 256
): THREE.CanvasTexture | null {
  if (textureType === 'flat') return null;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Fill with base color
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);

  switch (textureType) {
    case 'brick': {
      const brickH = size / 8;
      const brickW = size / 4;
      ctx.strokeStyle = 'rgba(80, 60, 40, 0.4)';
      ctx.lineWidth = 2;
      for (let row = 0; row < 8; row++) {
        const offset = row % 2 === 0 ? 0 : brickW / 2;
        for (let col = -1; col < 5; col++) {
          ctx.strokeRect(offset + col * brickW, row * brickH, brickW, brickH);
          // Add slight color variation per brick
          ctx.fillStyle = `rgba(${Math.random() * 30}, ${Math.random() * 20}, 0, 0.08)`;
          ctx.fillRect(offset + col * brickW + 2, row * brickH + 2, brickW - 4, brickH - 4);
        }
      }
      break;
    }
    case 'stone': {
      // Irregular stone pattern
      for (let i = 0; i < 12; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const w = 30 + Math.random() * 60;
        const h = 20 + Math.random() * 40;
        ctx.strokeStyle = `rgba(60, 60, 60, ${0.2 + Math.random() * 0.2})`;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = `rgba(${Math.random() * 40}, ${Math.random() * 40}, ${Math.random() * 40}, 0.1)`;
        ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
      }
      break;
    }
    case 'wood_panel': {
      // Vertical wood grain lines
      for (let x = 0; x < size; x += 2) {
        const alpha = 0.03 + Math.random() * 0.08;
        ctx.strokeStyle = `rgba(60, 30, 0, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + (Math.random() - 0.5) * 3, size);
        ctx.stroke();
      }
      // Panel seams
      for (let x = 0; x < size; x += size / 4) {
        ctx.strokeStyle = 'rgba(40, 20, 0, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, size);
        ctx.stroke();
      }
      break;
    }
    case 'concrete': {
      // Speckled noise
      for (let i = 0; i < 2000; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const gray = Math.random() * 60;
        ctx.fillStyle = `rgba(${gray}, ${gray}, ${gray}, 0.15)`;
        ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
      }
      break;
    }
    case 'plaster': {
      // Subtle swirled texture
      for (let i = 0; i < 500; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        ctx.fillStyle = `rgba(200, 190, 175, ${Math.random() * 0.1})`;
        ctx.beginPath();
        ctx.arc(x, y, 2 + Math.random() * 5, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'marble': {
      // Marble veining
      ctx.strokeStyle = 'rgba(180, 170, 160, 0.25)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        let x = Math.random() * size;
        let y = 0;
        ctx.moveTo(x, y);
        while (y < size) {
          x += (Math.random() - 0.5) * 30;
          y += 5 + Math.random() * 15;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      break;
    }
    case 'granite': {
      // Dense speckled
      for (let i = 0; i < 5000; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const colors = ['rgba(40,40,40,0.2)', 'rgba(100,100,100,0.15)', 'rgba(160,160,160,0.1)', 'rgba(200,200,200,0.1)'];
        ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
        ctx.fillRect(x, y, 1 + Math.random(), 1 + Math.random());
      }
      break;
    }
    case 'ceramic': {
      // Grid tile pattern
      const tileSize = size / 4;
      ctx.strokeStyle = 'rgba(180, 180, 180, 0.5)';
      ctx.lineWidth = 2;
      for (let x = 0; x <= size; x += tileSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke();
      }
      for (let y = 0; y <= size; y += tileSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
      }
      break;
    }
    case 'hardwood': {
      // Horizontal wood grain with plank seams
      for (let y = 0; y < size; y += 1) {
        const alpha = 0.02 + Math.random() * 0.06;
        ctx.strokeStyle = `rgba(80, 40, 0, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(size, y + (Math.random() - 0.5) * 2);
        ctx.stroke();
      }
      // Plank seams (horizontal)
      for (let y = 0; y < size; y += size / 5) {
        ctx.strokeStyle = 'rgba(50, 25, 0, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
      }
      break;
    }
    case 'carpet': {
      // Fuzzy noise pattern
      for (let i = 0; i < 8000; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        ctx.fillStyle = `rgba(${Math.random() * 50}, ${Math.random() * 50}, ${Math.random() * 50}, 0.06)`;
        ctx.fillRect(x, y, 1, 1);
      }
      break;
    }
    case 'vinyl': {
      // Subtle embossed pattern
      for (let y = 0; y < size; y += 3) {
        const alpha = 0.02 + Math.random() * 0.04;
        ctx.strokeStyle = `rgba(100, 70, 40, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(size, y);
        ctx.stroke();
      }
      break;
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  return texture;
}

/**
 * Builds the extruded shell: one flat floor mesh per room (colored by its
 * material) and a box per polygon edge for walls. Now supports per-room
 * wall colors, wall textures, and floor materials with procedural textures.
 */
export function buildHouseScene(
  container: HTMLElement,
  rooms: RoomShape[],
  initial: {
    wallColorHex?: string;
    roomMaterials?: Record<string, RoomMaterials>;
  },
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

  // ── Per-room tracking ───────────────────────────────────────────
  const wallMeshesByRoom = new Map<string, THREE.Mesh[]>();
  const floorMeshByRoom = new Map<string, THREE.Mesh>();
  const roomMaterialsCopy: Record<string, RoomMaterials> = {};

  const defaultWallColor = initial.wallColorHex ?? '#f2f0ea';

  for (const room of rooms) {
    const rm = initial.roomMaterials?.[room.id] ?? {
      wallColor: defaultWallColor,
      wallTexture: 'flat',
      floorMaterial: 'raw_concrete_floor',
      floorColor: '#9B9B93',
    };
    roomMaterialsCopy[room.id] = { ...rm };

    // ── Floor mesh ─────────────────────────────────────────────
    const pts = room.polygon;
    const shape = new THREE.Shape(pts.map(p => new THREE.Vector2(p.x, p.y)));
    const floorColor = rm.floorColor ?? '#9B9B93';
    const floorTextureType = getTextureTypeForMaterial(rm.floorMaterial);
    const floorTexture = generateProceduralTexture(floorTextureType, floorColor);

    const floorMat = new THREE.MeshStandardMaterial({
      color: floorColor,
      side: THREE.DoubleSide,
      ...(floorTexture ? { map: floorTexture } : {}),
    });
    const floorMesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    roomGroup.add(floorMesh);
    floorMeshByRoom.set(room.id, floorMesh);

    // ── Wall meshes ────────────────────────────────────────────
    const wallTexture = generateProceduralTexture(rm.wallTexture || 'flat', rm.wallColor);
    const wallMat = new THREE.MeshStandardMaterial({
      color: rm.wallColor,
      ...(wallTexture ? { map: wallTexture } : {}),
    });

    const wallMeshes: THREE.Mesh[] = [];
    for (let i = 0; i < pts.length; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % pts.length];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const length = Math.hypot(dx, dy);
      if (length < 1e-6) continue;

      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(length, room.wallHeightM, WALL_THICKNESS_M),
        wallMat.clone(), // Clone so per-room updates work
      );
      wall.position.set((p1.x + p2.x) / 2, room.wallHeightM / 2, (p1.y + p2.y) / 2);
      wall.rotation.y = -Math.atan2(dy, dx);
      roomGroup.add(wall);
      wallMeshes.push(wall);
    }
    wallMeshesByRoom.set(room.id, wallMeshes);
  }

  // ── Animation loop ──────────────────────────────────────────────
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

  // ── Scene handle (public API for live updates) ──────────────────
  return {
    setWallColor(hex: string, roomId?: string) {
      const targetRooms = roomId
        ? [roomId]
        : rooms.map(r => r.id);
      for (const rId of targetRooms) {
        const meshes = wallMeshesByRoom.get(rId);
        if (meshes) {
          for (const mesh of meshes) {
            (mesh.material as THREE.MeshStandardMaterial).color.set(hex);
            (mesh.material as THREE.MeshStandardMaterial).map = null;
            (mesh.material as THREE.MeshStandardMaterial).needsUpdate = true;
          }
        }
      }
    },

    setWallTexture(roomId: string, textureType: string, colorHex: string) {
      const meshes = wallMeshesByRoom.get(roomId);
      if (!meshes) return;
      const texture = generateProceduralTexture(textureType, colorHex);
      for (const mesh of meshes) {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.color.set(colorHex);
        mat.map = texture;
        mat.needsUpdate = true;
      }
    },

    setFloorMaterial(roomId: string, _materialId: string, colorHex: string) {
      const mesh = floorMeshByRoom.get(roomId);
      if (!mesh) return;
      const textureType = getTextureTypeForMaterial(_materialId);
      const texture = generateProceduralTexture(textureType, colorHex);
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.color.set(colorHex);
      mat.map = texture;
      mat.needsUpdate = true;
    },

    updateAllRoomMaterials(roomMaterials: Record<string, RoomMaterials>) {
      for (const [roomId, rm] of Object.entries(roomMaterials)) {
        // Update walls
        const wallMeshes = wallMeshesByRoom.get(roomId);
        if (wallMeshes) {
          const wallTextureType = rm.wallTexture || 'flat';
          const wallTexture = generateProceduralTexture(wallTextureType, rm.wallColor);
          for (const mesh of wallMeshes) {
            const mat = mesh.material as THREE.MeshStandardMaterial;
            mat.color.set(rm.wallColor);
            mat.map = wallTexture;
            mat.needsUpdate = true;
          }
        }
        // Update floor
        const floorMesh = floorMeshByRoom.get(roomId);
        if (floorMesh) {
          const floorColor = rm.floorColor ?? '#9B9B93';
          const floorTextureType = getTextureTypeForMaterial(rm.floorMaterial);
          const floorTexture = generateProceduralTexture(floorTextureType, floorColor);
          const mat = floorMesh.material as THREE.MeshStandardMaterial;
          mat.color.set(floorColor);
          mat.map = floorTexture;
          mat.needsUpdate = true;
        }
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

// ── Helpers ──────────────────────────────────────────────────────────

function polygonsCenter(rooms: RoomShape[]): { x: number; z: number } {
  let sx = 0;
  let sz = 0;
  let n = 0;
  for (const room of rooms) {
    for (const p of room.polygon) {
      sx += p.x;
      sz += p.y;
      n++;
    }
  }
  return n === 0 ? { x: 0, z: 0 } : { x: sx / n, z: sz / n };
}

/**
 * Maps a material catalog ID to its procedural texture type.
 * This is a simple suffix/prefix match — the full catalog lives server-side,
 * but the widget only needs the texture type to render.
 */
function getTextureTypeForMaterial(materialId: string): string {
  if (!materialId) return 'flat';
  if (materialId.includes('marble')) return 'marble';
  if (materialId.includes('granite')) return 'granite';
  if (materialId.includes('ceramic') || materialId.includes('porcelain')) return 'ceramic';
  if (materialId.includes('hardwood') || materialId.includes('oak') ||
      materialId.includes('walnut') || materialId.includes('teak') ||
      materialId.includes('maple') || materialId.includes('cherry') ||
      materialId.includes('bamboo')) return 'hardwood';
  if (materialId.includes('carpet')) return 'carpet';
  if (materialId.includes('vinyl')) return 'vinyl';
  if (materialId.includes('concrete')) return 'concrete';
  if (materialId.includes('brick')) return 'brick';
  if (materialId.includes('stone') || materialId.includes('slate') ||
      materialId.includes('limestone')) return 'stone';
  if (materialId.includes('wood_panel')) return 'wood_panel';
  if (materialId.includes('plaster')) return 'plaster';
  return 'flat';
}
