/**
 * Viewer.jsx — Three.js canvas mount.
 * Handles OrbitControls (orbit mode) and PointerLockControls (walkthrough mode).
 * Exposes flyToRoom(roomId) via ref.
 */
import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import { buildScene } from './SceneBuilder.js'
import { buildCustomScene } from './CustomSceneBuilder.js'
import { getRoomFlyTarget } from './SceneBuilder.js'
import { resolveCollision } from './WallCollider.js'

const WALK_SPEED = 4.0   // m/s
const FLY_DURATION = 800 // ms

const Viewer = forwardRef(function Viewer({ plan, viewMode, showRoof, onRoomEnter, onRoomsParsed }, ref) {
  const mountRef = useRef(null)
  const stateRef = useRef({
    renderer: null, scene: null, camera: null,
    orbitControls: null, pointerControls: null,
    wallAABBs: [], roomCentroids: {}, roomMeshes: {},
    animFrameId: null,
    keys: {},
    flyTween: null,
    activeRoom: null,
  })

  // ── Expose flyToRoom via ref ───────────────────────────────
  useImperativeHandle(ref, () => ({
    flyToRoom(roomId) {
      const s = stateRef.current
      const centroid = s.roomCentroids[roomId]
      if (!centroid) return
      _startFlyTween(s, centroid)
    },
    captureTopView() {
      const s = stateRef.current
      if (!s.renderer || !s.scene || !s.camera) return null

      // Save current state
      const prevPos = s.camera.position.clone()
      const prevRot = s.camera.rotation.clone()
      const prevTarget = s.orbitControls?.target.clone()

      // Find scene center from room centroids
      const centroids = Object.values(s.roomCentroids)
      const cx = centroids.length ? centroids.reduce((a, c) => a + c.x, 0) / centroids.length : 0
      const cz = centroids.length ? centroids.reduce((a, c) => a + c.z, 0) / centroids.length : 0

      // Position camera directly overhead, looking straight down
      s.camera.position.set(cx, 40, cz)
      s.camera.lookAt(cx, 0, cz)
      if (s.orbitControls) s.orbitControls.target.set(cx, 0, cz)

      // Render
      s.renderer.render(s.scene, s.camera)
      const dataUrl = s.renderer.domElement.toDataURL('image/png')

      // Restore camera
      s.camera.position.copy(prevPos)
      s.camera.rotation.copy(prevRot)
      if (s.orbitControls && prevTarget) {
        s.orbitControls.target.copy(prevTarget)
        s.orbitControls.update()
      }

      return dataUrl
    },
  }))

  // ── Handle Roof Toggle ───────────────────────────────────────────
  useEffect(() => {
    const s = stateRef.current
    if (!s || !s.roomMeshes) return
    Object.values(s.roomMeshes).forEach(room => {
      if (room.ceiling) room.ceiling.visible = showRoof
    })
  }, [showRoof])

  // ── Init Three.js ──────────────────────────────────────────
  useEffect(() => {
    if (!plan || !mountRef.current) return
    const el = mountRef.current
    const s = stateRef.current

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(el.clientWidth, el.clientHeight)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    el.appendChild(renderer.domElement)
    s.renderer = renderer

    // Camera
    const camera = new THREE.PerspectiveCamera(60, el.clientWidth / el.clientHeight, 0.05, 500)
    camera.position.set(10, 12, 18)
    s.camera = camera

    // 3. Build Scene based on Schema
    let sceneData;
    if (plan.metadata?.coordinate_system === 'y_up_x_z_floor') {
      sceneData = buildCustomScene(plan)
    } else {
      sceneData = buildScene(plan)
    }
    const { scene, wallAABBs, roomCentroids, roomMeshes, startPosition, parsedRooms } = sceneData
    s.scene = scene
    s.wallAABBs = wallAABBs
    s.roomCentroids = roomCentroids
    s.roomMeshes = roomMeshes
    if (onRoomsParsed && parsedRooms) {
      onRoomsParsed(parsedRooms)
    }

    // OrbitControls
    const orbit = new OrbitControls(camera, renderer.domElement)
    orbit.enableDamping = true
    orbit.dampingFactor = 0.08
    orbit.minDistance = 1
    orbit.maxDistance = 80
    orbit.maxPolarAngle = Math.PI * 0.85
    orbit.target.set(
      Object.values(roomCentroids).reduce((s, c) => s + c.x, 0) / Math.max(Object.keys(roomCentroids).length, 1),
      0,
      Object.values(roomCentroids).reduce((s, c) => s + c.z, 0) / Math.max(Object.keys(roomCentroids).length, 1),
    )
    orbit.update()
    s.orbitControls = orbit

    // PointerLockControls
    const pointer = new PointerLockControls(camera, renderer.domElement)
    s.pointerControls = pointer

    // Key handlers for walkthrough
    const onKeyDown = e => { s.keys[e.code] = true }
    const onKeyUp   = e => { s.keys[e.code] = false }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    // Resize
    const onResize = () => {
      if (!el) return
      camera.aspect = el.clientWidth / el.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(el.clientWidth, el.clientHeight)
    }
    window.addEventListener('resize', onResize)

    // Render loop
    let prevTime = performance.now()

    function animate() {
      s.animFrameId = requestAnimationFrame(animate)
      const now = performance.now()
      const delta = Math.min((now - prevTime) / 1000, 0.1)
      prevTime = now

      if (s.flyTween) {
        _tickFlyTween(s, now)
      } else if (s.pointerControls?.isLocked) {
        _tickWalkthrough(s, delta)
        _detectActiveRoom(s, onRoomEnter)
      } else {
        s.orbitControls?.update()
      }

      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(s.animFrameId)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('resize', onResize)
      orbit.dispose()
      pointer.dispose()
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [plan])

  // ── Mode switching ─────────────────────────────────────────
  useEffect(() => {
    const s = stateRef.current
    if (!s.orbitControls || !s.pointerControls) return

    if (viewMode === 'walkthrough') {
      s.orbitControls.enabled = false
      // Position camera at eye level if coming from orbit
      if (s.camera.position.y > 5) {
        const cx = s.camera.position.x
        const cz = s.camera.position.z
        s.camera.position.set(cx, 1.65, cz)
        s.camera.rotation.set(0, s.camera.rotation.y, 0)
      }
    } else {
      s.pointerControls.unlock()
      s.orbitControls.enabled = true
    }
  }, [viewMode])

  const handleCanvasClick = useCallback(() => {
    const s = stateRef.current
    if (viewMode === 'walkthrough' && !s.pointerControls?.isLocked) {
      s.pointerControls?.lock()
    }
  }, [viewMode])

  return (
    <div
      ref={mountRef}
      className="w-full h-full relative"
      onClick={handleCanvasClick}
      style={{ cursor: viewMode === 'walkthrough' ? 'crosshair' : 'grab' }}
    />
  )
})

export default Viewer

// ──────────────────────────────────────────────────────────────
// Internal helpers
// ──────────────────────────────────────────────────────────────
function _tickWalkthrough(s, delta) {
  const cam = s.camera
  const keys = s.keys
  const speed = WALK_SPEED * delta

  const dir = new THREE.Vector3()
  const right = new THREE.Vector3()

  cam.getWorldDirection(dir)
  dir.y = 0
  dir.normalize()
  right.crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize()

  const move = new THREE.Vector3()
  if (keys['KeyW'] || keys['ArrowUp'])    move.addScaledVector(dir,   speed)
  if (keys['KeyS'] || keys['ArrowDown'])  move.addScaledVector(dir,  -speed)
  if (keys['KeyA'] || keys['ArrowLeft'])  move.addScaledVector(right, -speed)
  if (keys['KeyD'] || keys['ArrowRight']) move.addScaledVector(right,  speed)

  if (move.lengthSq() === 0) return

  const proposed = cam.position.clone().add(move)
  proposed.y = cam.position.y  // lock vertical

  const safe = resolveCollision(proposed, s.wallAABBs)
  safe.y = 1.65  // eye height
  cam.position.copy(safe)
}

function _startFlyTween(s, centroid) {
  const { position: targetPos, target } = getRoomFlyTarget(centroid)
  s.flyTween = {
    startPos: s.camera.position.clone(),
    endPos: targetPos,
    startTarget: s.orbitControls ? s.orbitControls.target.clone() : centroid.clone(),
    endTarget: target,
    startTime: performance.now(),
  }
}

function _tickFlyTween(s, now) {
  const t = s.flyTween
  if (!t) return
  const elapsed = now - t.startTime
  const progress = Math.min(elapsed / FLY_DURATION, 1)
  const ease = 1 - Math.pow(1 - progress, 3)  // cubic ease-out

  s.camera.position.lerpVectors(t.startPos, t.endPos, ease)
  if (s.orbitControls) {
    s.orbitControls.target.lerpVectors(t.startTarget, t.endTarget, ease)
    s.orbitControls.update()
  }

  if (progress >= 1) s.flyTween = null
}

function _detectActiveRoom(s, onRoomEnter) {
  const camX = s.camera.position.x
  const camZ = s.camera.position.z
  let found = null

  for (const [roomId, centroid] of Object.entries(s.roomCentroids)) {
    if (Math.hypot(camX - centroid.x, camZ - centroid.z) < 3) {
      found = roomId
      break
    }
  }

  if (found !== s.activeRoom) {
    s.activeRoom = found
    onRoomEnter?.(found)
  }
}
