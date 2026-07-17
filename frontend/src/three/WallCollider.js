/**
 * WallCollider.js — Simple AABB collision for first-person walkthrough mode.
 * Prevents the camera from clipping through walls.
 */
import * as THREE from 'three'

const PLAYER_RADIUS = 0.35  // metres

/**
 * Given a list of AABBs and a proposed new position,
 * returns a safe position that doesn't penetrate any wall.
 */
export function resolveCollision(newPos, wallAABBs) {
  const safe = newPos.clone()
  const playerBox = new THREE.Box3(
    new THREE.Vector3(safe.x - PLAYER_RADIUS, safe.y - 0.1, safe.z - PLAYER_RADIUS),
    new THREE.Vector3(safe.x + PLAYER_RADIUS, safe.y + 1.8, safe.z + PLAYER_RADIUS),
  )

  for (const { box } of wallAABBs) {
    if (!playerBox.intersectsBox(box)) continue

    // Find overlap on each axis and push out on the smallest one
    const ox = Math.min(playerBox.max.x - box.min.x, box.max.x - playerBox.min.x)
    const oz = Math.min(playerBox.max.z - box.min.z, box.max.z - playerBox.min.z)

    if (ox < oz) {
      safe.x += playerBox.max.x - box.min.x < box.max.x - playerBox.min.x ? -ox : ox
    } else {
      safe.z += playerBox.max.z - box.min.z < box.max.z - playerBox.min.z ? -oz : oz
    }

    // Recompute player box after push
    playerBox.min.set(safe.x - PLAYER_RADIUS, safe.y - 0.1, safe.z - PLAYER_RADIUS)
    playerBox.max.set(safe.x + PLAYER_RADIUS, safe.y + 1.8, safe.z + PLAYER_RADIUS)
  }

  return safe
}
