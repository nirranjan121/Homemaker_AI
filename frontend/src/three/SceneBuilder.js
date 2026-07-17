/**
 * SceneBuilder.js — JSON → Three.js scene (deterministic, no ML)
 *
 * buildScene(plan) → { scene, wallAABBs, roomCentroids, roomMeshes }
 *
 * Coordinate mapping:
 *   pixel (px, py) → Three.js (px/ppm, 0, py/ppm)
 *   Y-axis is UP in Three.js. Walls are extruded along Y.
 */
import * as THREE from 'three'
import {
  getFloorMaterial, getWallMaterial, getCeilingMaterial,
  getRoomLabelTexture, clearTextureCache,
} from './materials.js'
import { buildFurniture } from './furniture.js'

const WALL_HEIGHT = 2.7   // metres
const WALL_MIN_THICKNESS = 0.05  // metres minimum
const DEFAULT_PPM = 100   // pixels per metre fallback

export function buildScene(plan) {
  clearTextureCache()

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1a1a2e)

  // ── Scale ─────────────────────────────────────────────────
  const sr = plan.scale_reference || {}
  const ppm = (sr.pixels && sr.meters)
    ? sr.pixels / sr.meters
    : DEFAULT_PPM

  const px2m = (v) => v / ppm

  // ── Lighting ──────────────────────────────────────────────
  _addLighting(scene)

  // ── Walls ─────────────────────────────────────────────────
  const wallAABBs = []
  const wallMeshMap = {}   // wallId → array of meshes (may be split by openings)

  // Pre-index doors + windows by wall_id
  const openingsByWall = {}
  for (const d of (plan.doors || [])) {
    d.openingType = 'door'
    if (!openingsByWall[d.wall_id]) openingsByWall[d.wall_id] = []
    openingsByWall[d.wall_id].push(d)
  }
  for (const w of (plan.windows || [])) {
    w.openingType = 'window'
    if (!openingsByWall[w.wall_id]) openingsByWall[w.wall_id] = []
    openingsByWall[w.wall_id].push(w)
  }

  const wallMat = getWallMaterial()

  for (const wall of (plan.walls || [])) {
    const sx = px2m(wall.start[0])
    const sz = px2m(wall.start[1])
    const ex = px2m(wall.end[0])
    const ez = px2m(wall.end[1])
    const thickness = Math.max(px2m(wall.thickness_px || 8), WALL_MIN_THICKNESS)

    const openings = (openingsByWall[wall.id] || []).sort(
      (a, b) => a.position_ratio - b.position_ratio
    )

    const segments = _splitWallByOpenings(0, 1, openings.map(o => ({
      start: Math.max(0, o.position_ratio - px2m(o.width_px || 30) / _wallLength(sx,sz,ex,ez) / 2),
      end:   Math.min(1, o.position_ratio + px2m(o.width_px || 30) / _wallLength(sx,sz,ex,ez) / 2),
    })))

    const wallLength = _wallLength(sx, sz, ex, ez)
    const angle = Math.atan2(ez - sz, ex - sx)

    for (const seg of segments) {
      const t0 = seg.start, t1 = seg.end
      const segLen = (t1 - t0) * wallLength
      if (segLen < 0.01) continue

      const midT = (t0 + t1) / 2
      const midX = sx + (ex - sx) * midT
      const midZ = sz + (ez - sz) * midT

      const geo = new THREE.BoxGeometry(segLen, WALL_HEIGHT, thickness)
      const mesh = new THREE.Mesh(geo, wallMat)
      mesh.position.set(midX, WALL_HEIGHT / 2, midZ)
      mesh.rotation.y = -angle
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.userData = { type: 'wall', wallId: wall.id, flagged: wall.flagged }

      scene.add(mesh)

      // AABB for collision (world-aligned bounding box)
      mesh.updateMatrixWorld(true)
      const box = new THREE.Box3().setFromObject(mesh)
      wallAABBs.push({ box, wallId: wall.id })

      if (!wallMeshMap[wall.id]) wallMeshMap[wall.id] = []
      wallMeshMap[wall.id].push(mesh)
    }

    // Build Openings (Lintels, Sills, Glass, Doors)
    for (const gap of openings) {
      const gapWidth = Math.max(px2m(gap.width_px || 30), 0.5) // Min 0.5m wide
      const gapT = gap.position_ratio
      const midX = sx + (ex - sx) * gapT
      const midZ = sz + (ez - sz) * gapT
      
      // Lintel (top wall)
      const lintelH = Math.max(0, WALL_HEIGHT - 2.1)
      if (lintelH > 0) {
        const lintelGeo = new THREE.BoxGeometry(gapWidth, lintelH, thickness)
        const lintel = new THREE.Mesh(lintelGeo, wallMat)
        lintel.position.set(midX, 2.1 + lintelH / 2, midZ)
        lintel.rotation.y = -angle
        lintel.castShadow = true; lintel.receiveShadow = true
        scene.add(lintel)
      }
      
      if (gap.openingType === 'window') {
        // Sill
        const sillH = 0.9
        const sillGeo = new THREE.BoxGeometry(gapWidth, sillH, thickness)
        const sill = new THREE.Mesh(sillGeo, wallMat)
        sill.position.set(midX, sillH / 2, midZ)
        sill.rotation.y = -angle
        sill.castShadow = true; sill.receiveShadow = true
        scene.add(sill)
        
        // Glass
        const glassGeo = new THREE.BoxGeometry(gapWidth, 2.1 - 0.9, 0.05)
        const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x88ccff, transmission: 0.9, opacity: 1, transparent: true, roughness: 0.1 })
        const glass = new THREE.Mesh(glassGeo, glassMat)
        glass.position.set(midX, 0.9 + (2.1 - 0.9)/2, midZ)
        glass.rotation.y = -angle
        scene.add(glass)
      } else if (gap.openingType === 'door') {
        // Door leaf (partially open)
        const leafGeo = new THREE.BoxGeometry(gapWidth, 2.1, 0.04)
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8 })
        const leaf = new THREE.Mesh(leafGeo, leafMat)
        
        // Pivot group at one side
        const pivot = new THREE.Group()
        pivot.position.set(midX - Math.cos(-angle) * (gapWidth/2), 2.1/2, midZ - Math.sin(-angle) * (gapWidth/2))
        pivot.rotation.y = -angle
        
        // Offset leaf so pivot is at its edge
        leaf.position.set(gapWidth / 2, 0, 0)
        leaf.castShadow = true
        pivot.add(leaf)
        
        // Swing open 45 degrees
        pivot.rotation.y += Math.PI / 4
        
        scene.add(pivot)
      }
    }
  }

  // ── Rooms (floors + ceilings + labels) ────────────────────
  const roomCentroids = {}
  const roomMeshes = {}

  for (const room of (plan.rooms || [])) {
    const poly = room.polygon || []
    if (poly.length < 3) continue

    const points2d = poly.map(p => new THREE.Vector2(px2m(p[0]), px2m(p[1])))

    const shape = new THREE.Shape(points2d)
    const floorGeo = new THREE.ShapeGeometry(shape)

    // Floor
    const floorMesh = new THREE.Mesh(floorGeo, getFloorMaterial(room.type))
    floorMesh.rotation.x = Math.PI / 2
    floorMesh.position.y = 0.001   // just above y=0
    floorMesh.receiveShadow = true
    floorMesh.userData = { type: 'floor', roomId: room.id, roomName: room.name, flagged: room.flagged }
    scene.add(floorMesh)

    // Ceiling
    const ceilGeo = new THREE.ShapeGeometry(shape)
    const ceilMesh = new THREE.Mesh(ceilGeo, getCeilingMaterial())
    ceilMesh.rotation.x = Math.PI / 2
    ceilMesh.position.y = WALL_HEIGHT - 0.001
    ceilMesh.visible = false // Default to naked view
    ceilMesh.userData = { type: 'ceiling', roomId: room.id }
    scene.add(ceilMesh)

    // Centroid
    const cx = points2d.reduce((s, p) => s + p.x, 0) / points2d.length
    const cz = points2d.reduce((s, p) => s + p.y, 0) / points2d.length
    roomCentroids[room.id] = new THREE.Vector3(cx, 1.5, cz)

    // Label sprite
    const labelTex = getRoomLabelTexture(room.name, room.type)
    const spriteMat = new THREE.SpriteMaterial({ map: labelTex, transparent: true })
    const sprite = new THREE.Sprite(spriteMat)
    sprite.position.set(cx, 2.0, cz)
    sprite.scale.set(1.6, 0.5, 1)
    sprite.userData = { type: 'label', roomId: room.id }
    scene.add(sprite)

    // Furniture
    const bb = new THREE.Box3().setFromPoints(points2d)
    const roomWidth = bb.max.x - bb.min.x
    const roomLength = bb.max.y - bb.min.y
    const furniture = buildFurniture(room.type, roomWidth, roomLength)
    if (furniture) {
      furniture.position.set(cx, 0, cz)
      
      // Auto-align furniture with the longest dimension of the room bounding box
      if (roomWidth > roomLength * 1.5) {
        furniture.rotation.y = Math.PI / 2
      }
      
      scene.add(furniture)
    }

    roomMeshes[room.id] = { floor: floorMesh, ceiling: ceilMesh, sprite, furniture }
  }

  // ── Floor base plane ──────────────────────────────────────
  const baseGeo = new THREE.PlaneGeometry(200, 200)
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x0e0e18, roughness: 1 })
  const base = new THREE.Mesh(baseGeo, baseMat)
  base.rotation.x = -Math.PI / 2
  base.position.y = -0.01
  base.receiveShadow = true
  scene.add(base)

  return { scene, wallAABBs, roomCentroids, roomMeshes }
}

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────
function _wallLength(sx, sz, ex, ez) {
  return Math.hypot(ex - sx, ez - sz) || 0.01
}

function _splitWallByOpenings(wallStart, wallEnd, gaps) {
  // gaps: [{start: 0..1, end: 0..1}] normalized along wall
  const segments = []
  let cursor = wallStart
  for (const gap of gaps) {
    const gs = Math.max(cursor, gap.start)
    const ge = Math.min(wallEnd, gap.end)
    if (gs > cursor + 0.001) {
      segments.push({ start: cursor, end: gs })
    }
    cursor = ge
  }
  if (cursor < wallEnd - 0.001) {
    segments.push({ start: cursor, end: wallEnd })
  }
  // Fallback: no gaps defined
  if (segments.length === 0) {
    segments.push({ start: wallStart, end: wallEnd })
  }
  return segments
}

function _addLighting(scene) {
  // Ambient
  const ambient = new THREE.AmbientLight(0xffffff, 0.8)
  scene.add(ambient)

  // Warm sun from top-right
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.0)
  sun.position.set(15, 20, 10)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.near = 0.5
  sun.shadow.camera.far = 100
  sun.shadow.camera.left = -30
  sun.shadow.camera.right = 30
  sun.shadow.camera.top = 30
  sun.shadow.camera.bottom = -30
  sun.shadow.bias = -0.001
  scene.add(sun)

  // Cool fill from opposite side
  const fill = new THREE.DirectionalLight(0xc8d8ff, 0.5)
  fill.position.set(-10, 10, -10)
  scene.add(fill)

  // Hemisphere sky/ground
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4)
  scene.add(hemi)
}

/**
 * Get the camera "fly-to" position for a room
 * Returns { position: Vector3, target: Vector3 }
 */
export function getRoomFlyTarget(centroid) {
  return {
    position: new THREE.Vector3(centroid.x, centroid.y + 3, centroid.z + 4),
    target: centroid.clone(),
  }
}
