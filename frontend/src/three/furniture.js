/**
 * furniture.js — Procedural low-poly furniture factory using Three.js primitives.
 * All dimensions are in meters.
 */
import * as THREE from 'three'

const MATS = {
  wood: new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.9 }),
  fabric: new THREE.MeshStandardMaterial({ color: 0x4a5a7a, roughness: 1.0 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.5 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.6, roughness: 0.4 }),
  black: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 }),
}

export function buildFurniture(roomType, roomWidth = 3, roomLength = 3) {
  const group = new THREE.Group()

  switch (roomType) {
    case 'bedroom':
      group.add(createBed())
      break
    case 'living_room':
      group.add(createSofaSet())
      break
    case 'dining_room':
      group.add(createDiningSet())
      break
    case 'kitchen':
      group.add(createKitchenIsland())
      break
    case 'bathroom':
      group.add(createBathroomFixtures())
      break
    case 'garage':
      group.add(createCarPlaceholder())
      break
    case 'closet':
      group.add(createWardrobe())
      break
    default:
      // Leave empty for hallways/others
      break
  }

  return group
}

// ── Components ────────────────────────────────────────────────────────

function createBed() {
  const bed = new THREE.Group()
  // Frame (2m x 1.6m x 0.3m)
  const frameGeo = new THREE.BoxGeometry(1.6, 0.3, 2.0)
  const frame = new THREE.Mesh(frameGeo, MATS.wood)
  frame.position.y = 0.15
  frame.castShadow = true; frame.receiveShadow = true
  bed.add(frame)

  // Mattress
  const matGeo = new THREE.BoxGeometry(1.5, 0.2, 1.9)
  const mattress = new THREE.Mesh(matGeo, MATS.white)
  mattress.position.y = 0.4
  mattress.castShadow = true; mattress.receiveShadow = true
  bed.add(mattress)

  // Pillows
  const pillowGeo = new THREE.BoxGeometry(0.5, 0.1, 0.3)
  const p1 = new THREE.Mesh(pillowGeo, MATS.white)
  p1.position.set(-0.35, 0.55, -0.7)
  const p2 = new THREE.Mesh(pillowGeo, MATS.white)
  p2.position.set(0.35, 0.55, -0.7)
  bed.add(p1, p2)

  return bed
}

function createSofaSet() {
  const set = new THREE.Group()
  
  // Sofa base (2.2m x 0.8m x 0.4m)
  const baseGeo = new THREE.BoxGeometry(2.2, 0.4, 0.8)
  const base = new THREE.Mesh(baseGeo, MATS.fabric)
  base.position.set(0, 0.2, 1)
  base.castShadow = true; base.receiveShadow = true
  set.add(base)

  // Sofa back
  const backGeo = new THREE.BoxGeometry(2.2, 0.5, 0.2)
  const back = new THREE.Mesh(backGeo, MATS.fabric)
  back.position.set(0, 0.65, 1.3)
  back.castShadow = true; back.receiveShadow = true
  set.add(back)

  // Coffee Table
  const tableGeo = new THREE.BoxGeometry(1.2, 0.4, 0.6)
  const table = new THREE.Mesh(tableGeo, MATS.wood)
  table.position.set(0, 0.2, 0)
  table.castShadow = true; table.receiveShadow = true
  set.add(table)

  // TV Stand
  const tvStandGeo = new THREE.BoxGeometry(1.8, 0.5, 0.4)
  const tvStand = new THREE.Mesh(tvStandGeo, MATS.wood)
  tvStand.position.set(0, 0.25, -1.5)
  tvStand.castShadow = true; tvStand.receiveShadow = true
  set.add(tvStand)

  // TV
  const tvGeo = new THREE.BoxGeometry(1.4, 0.8, 0.05)
  const tv = new THREE.Mesh(tvGeo, MATS.black)
  tv.position.set(0, 0.9, -1.5)
  set.add(tv)

  return set
}

function createDiningSet() {
  const set = new THREE.Group()
  
  // Table
  const topGeo = new THREE.BoxGeometry(1.8, 0.05, 1.0)
  const top = new THREE.Mesh(topGeo, MATS.wood)
  top.position.y = 0.75
  top.castShadow = true; top.receiveShadow = true
  set.add(top)

  // Leg
  const legGeo = new THREE.BoxGeometry(0.8, 0.75, 0.4)
  const leg = new THREE.Mesh(legGeo, MATS.wood)
  leg.position.y = 0.375
  leg.castShadow = true; leg.receiveShadow = true
  set.add(leg)

  // Chairs (4x)
  const cGeo = new THREE.BoxGeometry(0.4, 0.45, 0.4)
  const positions = [
    [-0.5, 0.225, 0.7], [0.5, 0.225, 0.7],
    [-0.5, 0.225, -0.7], [0.5, 0.225, -0.7]
  ]
  positions.forEach(pos => {
    const chair = new THREE.Mesh(cGeo, MATS.fabric)
    chair.position.set(...pos)
    chair.castShadow = true; chair.receiveShadow = true
    set.add(chair)
  })

  return set
}

function createKitchenIsland() {
  const island = new THREE.Group()
  
  // Base
  const baseGeo = new THREE.BoxGeometry(2.4, 0.85, 0.9)
  const base = new THREE.Mesh(baseGeo, MATS.wood)
  base.position.y = 0.425
  base.castShadow = true; base.receiveShadow = true
  island.add(base)

  // Countertop (marble-like)
  const topGeo = new THREE.BoxGeometry(2.5, 0.05, 1.0)
  const top = new THREE.Mesh(topGeo, MATS.white)
  top.position.y = 0.875
  top.castShadow = true; top.receiveShadow = true
  island.add(top)

  // Sink hole (dark patch)
  const sinkGeo = new THREE.BoxGeometry(0.6, 0.06, 0.4)
  const sink = new THREE.Mesh(sinkGeo, MATS.metal)
  sink.position.set(0.5, 0.875, 0)
  island.add(sink)

  return island
}

function createBathroomFixtures() {
  const fix = new THREE.Group()
  
  // Bathtub
  const tubGeo = new THREE.BoxGeometry(1.6, 0.5, 0.7)
  const tub = new THREE.Mesh(tubGeo, MATS.white)
  tub.position.set(-0.5, 0.25, 0)
  tub.castShadow = true; tub.receiveShadow = true
  fix.add(tub)

  // Vanity
  const vanityGeo = new THREE.BoxGeometry(0.8, 0.8, 0.5)
  const vanity = new THREE.Mesh(vanityGeo, MATS.wood)
  vanity.position.set(1.0, 0.4, 0)
  vanity.castShadow = true; vanity.receiveShadow = true
  fix.add(vanity)

  return fix
}

function createCarPlaceholder() {
  const car = new THREE.Group()
  // Body
  const bodyGeo = new THREE.BoxGeometry(1.8, 0.6, 4.2)
  const body = new THREE.Mesh(bodyGeo, MATS.metal)
  body.position.y = 0.4
  body.castShadow = true; body.receiveShadow = true
  car.add(body)
  
  // Cabin
  const cabinGeo = new THREE.BoxGeometry(1.4, 0.5, 2.0)
  const cabin = new THREE.Mesh(cabinGeo, MATS.black)
  cabin.position.set(0, 0.95, -0.2)
  car.add(cabin)
  return car
}

function createWardrobe() {
  const boxGeo = new THREE.BoxGeometry(1.2, 2.2, 0.6)
  const box = new THREE.Mesh(boxGeo, MATS.wood)
  box.position.y = 1.1
  box.castShadow = true; box.receiveShadow = true
  return box
}
