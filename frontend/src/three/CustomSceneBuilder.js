/**
 * CustomSceneBuilder.js
 * 
 * Premium accurate 3D scene from the JSON schema.
 */
import * as THREE from 'three'

// ── Math Helpers ────────────────────────────────────────────────────────
function projectPointOnSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az
  const lenSq = dx * dx + dz * dz
  if (lenSq < 1e-9) return 0
  const t = ((px - ax) * dx + (pz - az) * dz) / lenSq
  return Math.max(0, Math.min(1, t))
}

function distToSegment(px, pz, ax, az, bx, bz) {
  const t = projectPointOnSegment(px, pz, ax, az, bx, bz)
  const projX = ax + t * (bx - ax)
  const projZ = az + t * (bz - az)
  return { dist: Math.hypot(px - projX, pz - projZ), t, projX, projZ }
}

function findRoomsByFloodFill(planWalls) {
  const RES = 20; // 20 pixels per meter (5cm resolution)
  const W = 800, H = 800; // 40m x 40m
  const grid = new Uint8Array(W * H);

  // 1. Rasterize walls
  for (const wall of (planWalls || [])) {
    const x1 = wall.x1, z1 = wall.z1, x2 = wall.x2, z2 = wall.z2;
    const t = wall.thickness || 0.2;
    const r = (t / 2) * RES;
    const len = Math.hypot(x2 - x1, z2 - z1) * RES;
    const steps = Math.ceil(len * 2);
    for (let i = 0; i <= steps; i++) {
      const px = x1 + (x2 - x1) * (i / steps);
      const pz = z1 + (z2 - z1) * (i / steps);
      const cx = Math.floor(px * RES);
      const cy = Math.floor(pz * RES);
      const radius = Math.ceil(r);
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx*dx + dy*dy <= radius*radius) {
            const gx = cx + dx, gy = cy + dy;
            if (gx >= 0 && gx < W && gy >= 0 && gy < H) {
              grid[gy * W + gx] = 1;
            }
          }
        }
      }
    }
  }

  // 2. Flood fill to find enclosed regions
  const visited = new Uint8Array(W * H);
  const regions = [];
  const q = new Int32Array(W * H * 2); // preallocate queue

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      if (grid[idx] === 0 && visited[idx] === 0) {
        let head = 0, tail = 0;
        q[tail++] = x;
        q[tail++] = y;
        visited[idx] = 1;
        
        let area = 0;
        let sumX = 0, sumY = 0;
        let isOuter = false;
        const pixels = [];
        let minX = W, maxX = 0, minZ = H, maxZ = 0;

        while (head < tail) {
          const cx = q[head++];
          const cy = q[head++];
          area++;
          sumX += cx;
          sumY += cy;
          pixels.push(cx, cy);
          
          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minZ) minZ = cy;
          if (cy > maxZ) maxZ = cy;

          if (cx === 0 || cx === W - 1 || cy === 0 || cy === H - 1) isOuter = true;

          // Check 4 neighbors
          for (let i = 0; i < 4; i++) {
            const nx = cx + (i===0?1:i===1?-1:0);
            const ny = cy + (i===2?1:i===3?-1:0);
            if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
              const nidx = ny * W + nx;
              if (grid[nidx] === 0 && visited[nidx] === 0) {
                visited[nidx] = 1;
                q[tail++] = nx;
                q[tail++] = ny;
              }
            }
          }
        }

        if (!isOuter && area > 200) { // > 0.5 sq m
          regions.push({
            cx: (sumX / area) / RES,
            cz: (sumY / area) / RES,
            area: area / (RES * RES),
            pixels: pixels,
            w: (maxX - minX) / RES,
            d: (maxZ - minZ) / RES
          });
        }
      }
    }
  }
  return { regions, W, H, RES };
}

function convexHull2D(points) {
  if (points.length < 3) return points
  const pts = [...points].sort((a, b) => a.x !== b.x ? a.x - b.x : a.z - b.z)
  const cross = (o, a, b) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x)
  const lower = [], upper = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
    lower.push(p)
  }
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
    upper.push(p)
  }
  upper.pop(); lower.pop()
  return lower.concat(upper)
}

export function buildCustomScene(rawPlan, roomMaterials = {}) {
  // ═══════════════════════════════════════════════════════════
  // 0. DATA NORMALIZATION & SCALING
  // ═══════════════════════════════════════════════════════════
  // Calculate physical scale from pixels to meters
  let scale = 0.02; // Default 1 pixel = 2cm if scale is completely unknown
  if (rawPlan.scale_reference && rawPlan.scale_reference.pixels > 0) {
    scale = rawPlan.scale_reference.meters / rawPlan.scale_reference.pixels;
  }
  if (!isFinite(scale) || scale === 0) scale = 0.02;

  // Deep clone and normalize the JSON from the Gemini API schema into our 3D engine schema
  const plan = {
    ...rawPlan,
    walls: (rawPlan.walls || []).map(w => {
      // API uses start/end in pixels. Old demo used x1/z1 in meters.
      const px1 = w.start ? w.start[0] : (w.x1 ? w.x1 / scale : 0);
      const pz1 = w.start ? w.start[1] : (w.z1 ? w.z1 / scale : 0);
      const px2 = w.end ? w.end[0] : (w.x2 ? w.x2 / scale : 0);
      const pz2 = w.end ? w.end[1] : (w.z2 ? w.z2 / scale : 0);
      const pThickness = w.thickness_px ? w.thickness_px : (w.thickness ? w.thickness / scale : 10);
      
      return {
        ...w,
        x1: px1 * scale,
        z1: pz1 * scale,
        x2: px2 * scale,
        z2: pz2 * scale,
        thickness: Math.max(0.05, pThickness * scale) // minimum 5cm thickness
      }
    }),
    rooms: (rawPlan.rooms || []).map(r => {
      let cx = 0, cz = 0;
      if (r.polygon && r.polygon.length > 0) {
        cx = r.polygon.reduce((sum, p) => sum + p[0], 0) / r.polygon.length;
        cz = r.polygon.reduce((sum, p) => sum + p[1], 0) / r.polygon.length;
      } else if (r.center) {
        cx = r.center.x / scale;
        cz = r.center.z / scale;
      }
      return {
        ...r,
        name: r.name || r.type || 'Room',
        center: { x: cx * scale, z: cz * scale },
        area_sq_ft: r.area_sq_ft || 0
      }
    }),
    openings: [...(rawPlan.doors || []), ...(rawPlan.windows || [])].map(o => {
      let px = 0, pz = 0;
      // Calculate absolute position based on wall position_ratio
      if (o.wall_id) {
        const wall = (rawPlan.walls || []).find(w => w.id === o.wall_id);
        if (wall) {
          const wx1 = wall.start ? wall.start[0] : (wall.x1 ? wall.x1 / scale : 0);
          const wz1 = wall.start ? wall.start[1] : (wall.z1 ? wall.z1 / scale : 0);
          const wx2 = wall.end ? wall.end[0] : (wall.x2 ? wall.x2 / scale : 0);
          const wz2 = wall.end ? wall.end[1] : (wall.z2 ? wall.z2 / scale : 0);
          px = wx1 + (wx2 - wx1) * (o.position_ratio || 0.5);
          pz = wz1 + (wz2 - wz1) * (o.position_ratio || 0.5);
        }
      } else if (o.position) {
        px = o.position.x / scale;
        pz = o.position.z / scale;
      }
      return {
        ...o,
        position: { x: px * scale, z: pz * scale },
        width: (o.width_px ? o.width_px * scale : (o.width || 0.9))
      }
    })
  };

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0f1015)
  scene.fog = new THREE.FogExp2(0x0f1015, 0.015)

  const wallAABBs = []
  const roomMeshes = {}
  const roomCentroids = {}
  const wallHeight = plan.metadata?.default_wall_height_meters || 2.8

  // ═══════════════════════════════════════════════════════════
  // 1. LIGHTING
  // ═══════════════════════════════════════════════════════════
  scene.add(new THREE.AmbientLight(0xffffff, 0.6))

  const sun = new THREE.DirectionalLight(0xffffff, 0.8)
  sun.position.set(25, 40, 15)
  sun.castShadow = true
  sun.shadow.mapSize.set(4096, 4096)
  sun.shadow.camera.near = 0.5
  sun.shadow.camera.far = 150
  sun.shadow.camera.left = -50
  sun.shadow.camera.right = 50
  sun.shadow.camera.top = 50
  sun.shadow.camera.bottom = -50
  sun.shadow.bias = -0.0005
  scene.add(sun)

  const fillLight = new THREE.DirectionalLight(0x88aaff, 0.4)
  fillLight.position.set(-20, 20, -20)
  scene.add(fillLight)

  // ═══════════════════════════════════════════════════════════
  // 2. GROUND & UNIFIED FLOOR
  // ═══════════════════════════════════════════════════════════
  // Grid background
  const grid = new THREE.GridHelper(100, 100, 0x333344, 0x1a1a24)
  grid.position.y = -0.01
  scene.add(grid)

  // Collect all wall endpoints for the building hull
  const allPts = []
  for (const w of (plan.walls || [])) {
    allPts.push({ x: w.x1, z: w.z1 }, { x: w.x2, z: w.z2 })
  }

  if (allPts.length > 2) {
    const hull = convexHull2D(allPts)
    const shape = new THREE.Shape()
    shape.moveTo(hull[0].x, hull[0].z)
    for (let i = 1; i < hull.length; i++) shape.lineTo(hull[i].x, hull[i].z)
    shape.closePath()

    const floorGeo = new THREE.ShapeGeometry(shape)
    const floorMat = new THREE.MeshStandardMaterial({ 
      color: 0x1c1e26, 
      roughness: 0.8,
      metalness: 0.2
    })
    const floorMesh = new THREE.Mesh(floorGeo, floorMat)
    floorMesh.rotation.x = -Math.PI / 2
    floorMesh.position.y = 0.01
    floorMesh.receiveShadow = true
    scene.add(floorMesh)
  }

  // ═══════════════════════════════════════════════════════════
  // 3. WALLS & DOOR GAPS
  // ═══════════════════════════════════════════════════════════
  const wallSideMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 })
  const wallTopMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.8 })
  const wallMats = [wallSideMat, wallSideMat, wallTopMat, wallSideMat, wallSideMat, wallSideMat]
  const jointGeo = new THREE.CylinderGeometry(1, 1, wallHeight, 16)

  // Map each door to its nearest wall
  const openingsByWall = {}
  const snappedDoors = []

  for (const op of (plan.openings || [])) {
    let bestWall = null, minDist = Infinity, bestProj = null

    for (const wall of (plan.walls || [])) {
      const res = distToSegment(op.position.x, op.position.z, wall.x1, wall.z1, wall.x2, wall.z2)
      if (res.dist < minDist) {
        minDist = res.dist
        bestWall = wall
        bestProj = res
      }
    }

    if (bestWall && minDist < 10.0) { // Aggressive snap to fix bad JSON coordinates
      if (!openingsByWall[bestWall.id]) openingsByWall[bestWall.id] = []
      openingsByWall[bestWall.id].push({ op, proj: bestProj })
      snappedDoors.push({ ...op, snapppedX: bestProj.projX, snappedZ: bestProj.projZ, wall: bestWall })
    } else {
      snappedDoors.push(op) // Keep unsnapped if too far
    }
  }

  for (const wall of (plan.walls || [])) {
    const x1 = wall.x1, z1 = wall.z1
    const x2 = wall.x2, z2 = wall.z2
    const h = wall.height || wallHeight
    const t = wall.thickness || 0.2

    const dx = x2 - x1
    const dz = z2 - z1
    const wLen = Math.hypot(dx, dz)
    if (wLen < 0.01) continue
    const angle = Math.atan2(dz, dx)

    // Calculate solid segments (cutting out gaps for snapped doors)
    const ops = openingsByWall[wall.id] || []
    const gapData = ops.map(o => {
      const halfWidth = (o.op.width || 0.9) / 2 / wLen
      return {
        t: o.proj.t,
        s: Math.max(0, o.proj.t - halfWidth),
        e: Math.min(1, o.proj.t + halfWidth)
      }
    }).sort((a, b) => a.s - b.s)

    const segments = []
    let cursor = 0
    for (const gap of gapData) {
      if (gap.s > cursor + 0.001) segments.push({ s: cursor, e: gap.s })
      cursor = gap.e
    }
    if (cursor < 1 - 0.001) segments.push({ s: cursor, e: 1 })
    if (segments.length === 0 && gapData.length === 0) segments.push({ s: 0, e: 1 })

    // Build solid wall segments
    for (const seg of segments) {
      const segLen = (seg.e - seg.s) * wLen
      if (segLen < 0.02) continue
      
      const midT = (seg.s + seg.e) / 2
      const midX = x1 + dx * midT
      const midZ = z1 + dz * midT

      const geo = new THREE.BoxGeometry(segLen, h, t)
      const mesh = new THREE.Mesh(geo, wallMats)
      mesh.position.set(midX, h / 2, midZ)
      mesh.rotation.y = -angle
      mesh.castShadow = true
      mesh.receiveShadow = true
      scene.add(mesh)
      
      mesh.updateMatrixWorld(true)
      wallAABBs.push({ box: new THREE.Box3().setFromObject(mesh), wallId: wall.id })
    }

    // Add lintels above the doors
    for (const gap of gapData) {
      const doorH = 2.1
      const lintelH = h - doorH
      if (lintelH > 0.05) {
        const midT = gap.t
        const midX = x1 + dx * midT
        const midZ = z1 + dz * midT
        const gapW = (gap.e - gap.s) * wLen
        
        const geo = new THREE.BoxGeometry(gapW, lintelH, t)
        const mesh = new THREE.Mesh(geo, wallMats)
        mesh.position.set(midX, doorH + lintelH / 2, midZ)
        mesh.rotation.y = -angle
        mesh.castShadow = true
        mesh.receiveShadow = true
        scene.add(mesh)
      }
    }

    // Corner joints
    const jointMat = [wallSideMat, wallTopMat, wallSideMat]
    for (const [px, pz] of [[x1, z1], [x2, z2]]) {
      const joint = new THREE.Mesh(jointGeo, jointMat)
      joint.position.set(px, h / 2, pz)
      joint.scale.set(t / 2, 1, t / 2)
      joint.castShadow = true
      joint.receiveShadow = true
      scene.add(joint)
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 4. SMART ROOM LABELS & COLORED FLOORS
  // ═══════════════════════════════════════════════════════════
  // Run flood fill to find the REAL enclosed rooms
  const { regions, W, H, RES } = findRoomsByFloodFill(plan.walls);

  // Map JSON rooms to the real regions based on proximity FIRST so we can color them
  const mappedRegions = new Set();
  for (const room of (plan.rooms || [])) {
    let cx = room.center.x, cz = room.center.z;
    
    let bestReg = null, minDist = Infinity;
    for (const reg of regions) {
      if (mappedRegions.has(reg)) continue;
      const d = Math.hypot(reg.cx - cx, reg.cz - cz);
      if (d < minDist) { minDist = d; bestReg = reg; }
    }

    if (bestReg && minDist < 15.0) {
      cx = bestReg.cx;
      cz = bestReg.cz;
      mappedRegions.add(bestReg);
      bestReg.roomName = room.name; // Tag region with room name
      room.computedW = bestReg.w;
      room.computedD = bestReg.d;
      room.computedArea = bestReg.area;
    }
  }

  // Generate a beautiful painted floor texture for all detected rooms
  const floorData = new Uint8Array(W * H * 4);
  const fallbackColors = [
    [60, 100, 160], [160, 80, 80], [80, 140, 90], [140, 120, 60], [120, 70, 130],
    [50, 130, 140], [140, 90, 110], [90, 100, 130]
  ];

  for (let i = 0; i < regions.length; i++) {
    const reg = regions[i];
    
    // Determine color
    let r, g, b;
    
    // Perform case-insensitive lookup to match Chatbot output with Scene room names
    let customHex = null;
    if (reg.roomName && roomMaterials) {
      const roomKey = Object.keys(roomMaterials).find(k => k.toLowerCase() === reg.roomName.toLowerCase());
      if (roomKey) customHex = roomMaterials[roomKey];
    }

    if (customHex) {
      const hex = customHex.replace('#', '');
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
      
      // Fallback if NaN (e.g. if chatbot outputs "yellow" instead of hex)
      if (isNaN(r)) r = 200;
      if (isNaN(g)) g = 200;
      if (isNaN(b)) b = 200;
    } else {
      [r, g, b] = fallbackColors[i % fallbackColors.length];
    }

    for (let p = 0; p < reg.pixels.length; p += 2) {
      const px = reg.pixels[p];
      const py = reg.pixels[p + 1];
      const idx = (py * W + px) * 4;
      floorData[idx] = r;
      floorData[idx + 1] = g;
      floorData[idx + 2] = b;
      floorData[idx + 3] = customHex ? 200 : 140; // higher opacity for custom colors
    }
  }

  const tex = new THREE.DataTexture(floorData, W, H, THREE.RGBAFormat);
  tex.flipY = true;
  tex.needsUpdate = true;
  
  const floorPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(W / RES, H / RES),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  );
  floorPlane.rotation.x = -Math.PI / 2;
  floorPlane.position.set((W / RES) / 2, 0.015, (H / RES) / 2);
  scene.add(floorPlane);

  for (const room of (plan.rooms || [])) {
    let cx = room.center.x, cz = room.center.z;
    if (room.computedW) {
      // It was mapped, use the region centroid
      for (const reg of mappedRegions) {
        if (reg.roomName === room.name) {
          cx = reg.cx; cz = reg.cz; break;
        }
      }
    }

    // Floating text label
    const canvas = document.createElement('canvas')
    canvas.width = 256; canvas.height = 64
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = 'rgba(15, 16, 21, 0.85)'
    ctx.roundRect(0, 0, 256, 64, 32)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 22px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(room.name, 128, 28)
    ctx.fillStyle = '#8899aa'
    ctx.font = '16px sans-serif'
    // Use the actual computed area of the region!
    const realArea = room.computedArea ? Math.round(room.computedArea * 10.764) : room.area_sq_ft;
    ctx.fillText(`${realArea} sq ft`, 128, 50)

    const spriteTex = new THREE.CanvasTexture(canvas)
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: spriteTex, transparent: true }))
    // Float labels higher so they don't clip into walls
    sprite.position.set(cx, 3.5, cz)
    sprite.scale.set(2.5, 0.625, 1)
    scene.add(sprite)

    roomCentroids[room.name] = new THREE.Vector3(cx, 1.5, cz)
  }

  // ═══════════════════════════════════════════════════════════
  // 5. DOORS
  // ═══════════════════════════════════════════════════════════
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x8899aa, roughness: 0.4, metalness: 0.3 })
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x444455, roughness: 0.6 })

  for (const op of snappedDoors) {
    if (op.type !== 'door') continue
    
    // Use snapped position if available, otherwise original
    const px = op.snapppedX ?? op.position.x
    const pz = op.snappedZ ?? op.position.z
    const w = op.width || 0.9
    const h = op.height || 2.1
    
    let angle = 0
    if (op.wall) {
      angle = Math.atan2(op.wall.z2 - op.wall.z1, op.wall.x2 - op.wall.x1)
    }

    const frameGeo = new THREE.BoxGeometry(w + 0.1, h + 0.05, 0.15)
    const frame = new THREE.Mesh(frameGeo, frameMat)
    frame.position.set(px, h / 2, pz)
    frame.rotation.y = -angle
    frame.castShadow = true
    scene.add(frame)

    const leafGeo = new THREE.BoxGeometry(w * 0.95, h - 0.05, 0.04)
    const leaf = new THREE.Mesh(leafGeo, doorMat)
    leaf.castShadow = true

    const pivot = new THREE.Group()
    pivot.position.set(
      px - Math.cos(-angle) * (w / 2),
      h / 2,
      pz - Math.sin(-angle) * (w / 2)
    )
    pivot.rotation.y = -angle
    leaf.position.set(w * 0.95 / 2, 0, 0)
    pivot.add(leaf)
    pivot.rotation.y += Math.PI / 3  // 60° open
    scene.add(pivot)
  }

  // ═══════════════════════════════════════════════════════════
  // 6. FURNITURE
  // ═══════════════════════════════════════════════════════════
  for (const item of (plan.fixtures_furniture || [])) {
    const { w, h, d } = item.bounding_box
    const geo = new THREE.BoxGeometry(w, h, d)
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
      metalness: 0.1,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(item.position.x, item.position.y, item.position.z)
    mesh.rotation.y = THREE.MathUtils.degToRad(item.rotation_y_deg || 0)
    mesh.castShadow = true
    mesh.receiveShadow = true
    scene.add(mesh)
  }

  // ═══════════════════════════════════════════════════════════
  // 7. CAMERA START POSITION
  // ═══════════════════════════════════════════════════════════
  let startPosition = new THREE.Vector3(17, 1.7, 14)
  if (plan.walkthrough_camera?.start_position) {
    const c = plan.walkthrough_camera.start_position
    startPosition = new THREE.Vector3(c.x, c.y, c.z)
  }

  return { scene, wallAABBs, roomCentroids, roomMeshes, startPosition, parsedRooms: plan.rooms }
}
