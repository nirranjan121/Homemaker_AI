/**
 * materials.js — Procedural floor/wall textures via HTML Canvas.
 * Zero external image dependencies.
 */
import * as THREE from 'three'

const TEXTURE_SIZE = 512

function makeTexture(drawFn) {
  const canvas = document.createElement('canvas')
  canvas.width = TEXTURE_SIZE
  canvas.height = TEXTURE_SIZE
  const ctx = canvas.getContext('2d')
  drawFn(ctx, TEXTURE_SIZE)
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(4, 4)
  return tex
}

function woodPlanks(ctx, s) {
  ctx.fillStyle = '#8B6914'
  ctx.fillRect(0, 0, s, s)
  const plankHeight = s / 8
  const colors = ['#7a5c10', '#8B6914', '#9a7520', '#7a5c10', '#8B6914',
                  '#6b4f0e', '#9a7520', '#8B6914']
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = colors[i]
    ctx.fillRect(0, i * plankHeight, s, plankHeight - 2)
    // grain lines
    ctx.strokeStyle = 'rgba(0,0,0,0.1)'
    ctx.lineWidth = 0.5
    for (let j = 0; j < 4; j++) {
      ctx.beginPath()
      ctx.moveTo(Math.random() * s, i * plankHeight)
      ctx.lineTo(Math.random() * s, (i + 1) * plankHeight)
      ctx.stroke()
    }
  }
}

function smallTiles(ctx, s) {
  const tileSize = s / 10
  for (let x = 0; x < 10; x++) {
    for (let y = 0; y < 10; y++) {
      const lum = 200 + Math.random() * 30
      ctx.fillStyle = `rgb(${lum},${lum},${lum})`
      ctx.fillRect(x * tileSize + 1, y * tileSize + 1, tileSize - 2, tileSize - 2)
    }
  }
  // grout
  ctx.fillStyle = '#c0c0c0'
  for (let x = 0; x <= 10; x++) {
    ctx.fillRect(x * tileSize, 0, 1, s)
  }
  for (let y = 0; y <= 10; y++) {
    ctx.fillRect(0, y * tileSize, s, 1)
  }
}

function largeTiles(ctx, s) {
  const tileSize = s / 4
  for (let x = 0; x < 4; x++) {
    for (let y = 0; y < 4; y++) {
      const base = 210 + Math.random() * 20
      ctx.fillStyle = `rgb(${base},${base - 5},${base - 10})`
      ctx.fillRect(x * tileSize + 2, y * tileSize + 2, tileSize - 4, tileSize - 4)
    }
  }
  ctx.strokeStyle = '#b8b8b8'
  ctx.lineWidth = 3
  for (let x = 0; x <= 4; x++) {
    ctx.beginPath(); ctx.moveTo(x * tileSize, 0); ctx.lineTo(x * tileSize, s); ctx.stroke()
  }
  for (let y = 0; y <= 4; y++) {
    ctx.beginPath(); ctx.moveTo(0, y * tileSize); ctx.lineTo(s, y * tileSize); ctx.stroke()
  }
}

function herringbone(ctx, s) {
  ctx.fillStyle = '#6b4f0e'
  ctx.fillRect(0, 0, s, s)
  const pw = s / 8
  const ph = pw * 2.5
  const angle = Math.PI / 4
  ctx.save()
  for (let row = -2; row < 10; row++) {
    for (let col = -2; col < 10; col++) {
      ctx.save()
      const x = col * pw * 2
      const y = row * ph / 2
      ctx.translate(x, y)
      ctx.rotate(row % 2 === 0 ? angle : -angle)
      const shade = 130 + Math.floor(Math.random() * 30)
      ctx.fillStyle = `rgb(${shade + 40},${shade + 10},${shade - 40})`
      ctx.fillRect(-pw / 2, -ph / 2, pw, ph)
      ctx.restore()
    }
  }
  ctx.restore()
}

function concreteTile(ctx, s) {
  const grd = ctx.createLinearGradient(0, 0, s, s)
  grd.addColorStop(0, '#b0b0b8')
  grd.addColorStop(1, '#9898a4')
  ctx.fillStyle = grd
  ctx.fillRect(0, 0, s, s)
  // subtle noise
  for (let i = 0; i < 2000; i++) {
    const x = Math.random() * s
    const y = Math.random() * s
    const alpha = Math.random() * 0.04
    ctx.fillStyle = `rgba(0,0,0,${alpha})`
    ctx.fillRect(x, y, 1, 1)
  }
}

function plainGray(ctx, s) {
  ctx.fillStyle = '#888898'
  ctx.fillRect(0, 0, s, s)
}

function rugTexture(ctx, s) {
  ctx.fillStyle = '#5c3a8a'
  ctx.fillRect(0, 0, s, s)
  const colors = ['#7a4fb5', '#4a2f7a', '#8a5fc5', '#6a3f9a']
  for (let i = 0; i < 6; i++) {
    ctx.strokeStyle = colors[i % colors.length]
    ctx.lineWidth = 3
    const inset = i * (s / 14)
    ctx.strokeRect(inset, inset, s - inset * 2, s - inset * 2)
  }
}

// Cache textures to avoid creating duplicate Canvas objects
const _cache = {}
function cached(key, drawFn) {
  if (!_cache[key]) _cache[key] = makeTexture(drawFn)
  return _cache[key]
}

export function getFloorMaterial(roomType) {
  const matDefs = {
    bedroom:     { color: 0x8B6914, map: () => cached('wood', woodPlanks) },
    living_room: { color: 0x8B6914, map: () => cached('wood', woodPlanks) },
    dining_room: { color: 0x7a5c10, map: () => cached('herringbone', herringbone) },
    bathroom:    { color: 0xe0e0e0, map: () => cached('smallTile', smallTiles) },
    kitchen:     { color: 0xd8d8d8, map: () => cached('largeTile', largeTiles) },
    hallway:     { color: 0xa0a0aa, map: () => cached('concrete', concreteTile) },
    closet:      { color: 0x888898, map: () => cached('gray', plainGray) },
    garage:      { color: 0x888898, map: () => cached('gray', plainGray) },
    other:       { color: 0x888898, map: () => cached('gray', plainGray) },
  }
  const def = matDefs[roomType] || matDefs['other']
  return new THREE.MeshStandardMaterial({
    color: def.color,
    map: def.map(),
    roughness: 0.8,
    metalness: 0.0,
    side: THREE.DoubleSide,
  })
}

export function getWallMaterial() {
  const sideMat = new THREE.MeshStandardMaterial({
    color: 0xf5f5f0,
    roughness: 0.9,
    metalness: 0.0,
  })
  const topMat = new THREE.MeshBasicMaterial({
    color: 0x222222,
  })
  return [sideMat, sideMat, topMat, sideMat, sideMat, sideMat]
}

export function getCeilingMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xfaf8f5,
    roughness: 1.0,
    metalness: 0.0,
    side: THREE.DoubleSide,
  })
}

export function getRoomLabelTexture(name, type) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 80
  const ctx = canvas.getContext('2d')

  const typeColors = {
    bedroom: '#a89fff', bathroom: '#5ec4e8', kitchen: '#f9a84d',
    living_room: '#5dd98a', dining_room: '#f9a84d', hallway: '#9098b8',
    closet: '#c0a070', garage: '#909090', other: '#9098b8',
  }
  const color = typeColors[type] || '#9098b8'

  ctx.fillStyle = 'rgba(10,10,20,0.75)'
  ctx.beginPath()
  ctx.roundRect(4, 4, 248, 72, 10)
  ctx.fill()

  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(4, 4, 248, 72, 10)
  ctx.stroke()

  ctx.fillStyle = color
  ctx.font = 'bold 22px Inter, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(name, 128, 38)

  ctx.fillStyle = 'rgba(200,200,220,0.6)'
  ctx.font = '14px Inter, sans-serif'
  ctx.fillText(type.replace(/_/g, ' '), 128, 62)

  const tex = new THREE.CanvasTexture(canvas)
  return tex
}

export function clearTextureCache() {
  Object.keys(_cache).forEach(k => {
    _cache[k].dispose()
    delete _cache[k]
  })
}
