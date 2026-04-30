import * as THREE from "three";
import type { LevelWorldBounds } from "../level/LevelTypes";
import {
  FALL_OOB_Y,
  GRAVITY,
  GROUND_RESTITUTION_Y,
  PHYS_FRICTION_PER_SEC,
  PHYS_SETTLE_SPEED,
  SHOT_LOB_RATIO,
  WALL_RESTITUTION,
} from "../core/Constants";

/** Legacy alias — playable xz clamp from level generator */
export type BallPhysicsBounds = LevelWorldBounds;

export interface PhysicsStepResult {
  /** Ball fell into the void or past recoverable height */
  oob?: boolean;
}

/** Optional environmental forces / surface feel for a single integration step. */
export interface PhysicsStepEnvironment {
  /** ≥1 — scales friction decay (higher = stronger slowdown). */
  frictionScale?: number;
  planarAccelX?: number;
  planarAccelZ?: number;
}

/**
 * Planar roll with friction on the deck, lobbed shots with gravity,
 * and falling past deck edges (no rubber band at forward/lateral cliffs).
 */
export class SimpleBallPhysics {
  readonly velocity = new THREE.Vector3(0, 0, 0);
  private settled = true;

  constructor(
    readonly radius: number,
    private bounds: LevelWorldBounds,
    /** World z beyond which there is no deck support (forward runway end). */
    private oobMaxZ: number,
  ) {}

  setBounds(next: LevelWorldBounds, oobZ: number): void {
    this.bounds = next;
    this.oobMaxZ = oobZ;
  }

  getOobMaxZ(): number {
    return this.oobMaxZ;
  }

  isSettled(): boolean {
    return this.settled;
  }

  markRolling(): void {
    this.settled = false;
  }

  settleHard(): void {
    this.velocity.set(0, 0, 0);
    this.settled = true;
  }

  applyShot(directionXZ: THREE.Vector2, speed: number): void {
    const dir = directionXZ.clone();
    if (dir.lengthSq() < 1e-8) return;
    dir.normalize();
    this.velocity.x = dir.x * speed;
    this.velocity.z = dir.y * speed;
    this.velocity.y = SHOT_LOB_RATIO * speed;
    this.settled = false;
  }

  step(
    position: THREE.Vector3,
    deltaSeconds: number,
    env?: PhysicsStepEnvironment,
  ): PhysicsStepResult {
    if (this.settled) return {};

    const dt = deltaSeconds;
    this.velocity.y -= GRAVITY * dt;

    const frictionScale = Math.max(1, env?.frictionScale ?? 1);
    const ax = env?.planarAccelX ?? 0;
    const az = env?.planarAccelZ ?? 0;
    this.velocity.x += ax * dt;
    this.velocity.z += az * dt;

    position.x += this.velocity.x * dt;
    position.z += this.velocity.z * dt;
    position.y += this.velocity.y * dt;

    const { minX, maxX, minZ } = this.bounds;
    const onDeckXZ =
      position.x >= minX &&
      position.x <= maxX &&
      position.z >= minZ &&
      position.z <= this.oobMaxZ;

    if (onDeckXZ && position.y < 0) {
      position.y = 0;
      if (this.velocity.y < 0) {
        this.velocity.y *= -GROUND_RESTITUTION_Y;
      }
      if (Math.abs(this.velocity.y) < 0.48) {
        this.velocity.y = 0;
      }
    }

    /** Damp micro-vertical jitter once the ball is rolling on the deck */
    if (
      onDeckXZ &&
      position.y > 0 &&
      position.y < 0.028 &&
      Math.abs(this.velocity.y) < 0.06
    ) {
      position.y = 0;
      this.velocity.y = 0;
    }

    const grounded =
      onDeckXZ &&
      position.y <= 0.002 &&
      Math.abs(this.velocity.y) < 0.008;

    if (grounded) {
      position.y = 0;
      this.velocity.y = 0;

      if (position.x < minX) {
        position.x = minX;
        this.velocity.x *= -WALL_RESTITUTION;
      } else if (position.x > maxX) {
        position.x = maxX;
        this.velocity.x *= -WALL_RESTITUTION;
      }

      if (position.z < minZ) {
        position.z = minZ;
        this.velocity.z *= -WALL_RESTITUTION;
      }

      const drag = Math.exp(-PHYS_FRICTION_PER_SEC * frictionScale * dt);
      this.velocity.x *= drag;
      this.velocity.z *= drag;

      const speed = Math.hypot(this.velocity.x, this.velocity.z);
      if (speed < PHYS_SETTLE_SPEED) {
        this.velocity.set(0, 0, 0);
        this.settled = true;
      }

      return {};
    }

    if (position.y < FALL_OOB_Y) {
      return { oob: true };
    }

    this.settled = false;
    return {};
  }
}
