import * as THREE from "three";
import { assetRegistry } from "../art/AssetRegistry";
import {
  bladeSteel,
  fanStone,
  PSX_SKY_BLUE,
  sandGold,
  skyBlueTransparent,
  warmCreamStone,
  woodBrown,
} from "../art/Materials";
import { BALL_RADIUS } from "../core/Constants";
import type { SimpleBallPhysics } from "../gameplay/SimpleBallPhysics";
import type { HazardSpawnSpec } from "../level/LevelTypes";
import {
  LANE_HALF_WIDTH,
  TILE_SIZE,
} from "../level/TileDimensions";
import type { HazardBallContext, HazardEnvironmental, HazardInstance } from "./Hazard";

const ARM_THICK = 0.22;

function tileBasis(rotationY: number): {
  fx: number;
  fz: number;
  rx: number;
  rz: number;
} {
  /** Forward +Z local → world */
  const fx = Math.sin(rotationY);
  const fz = Math.cos(rotationY);
  const rx = Math.cos(rotationY);
  const rz = -Math.sin(rotationY);
  return { fx, fz, rx, rz };
}

function worldToLocalXZ(
  px: number,
  pz: number,
  ox: number,
  oz: number,
  rx: number,
  rz: number,
  fx: number,
  fz: number,
): { lx: number; lz: number } {
  const dx = px - ox;
  const dz = pz - oz;
  return {
    lx: dx * rx + dz * rz,
    lz: dx * fx + dz * fz,
  };
}

function closestPointOnSegment2D(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): { x: number; z: number; t: number } {
  const abx = bx - ax;
  const abz = bz - az;
  const apx = px - ax;
  const apz = pz - az;
  const ab2 = abx * abx + abz * abz;
  let t = ab2 > 1e-8 ? (apx * abx + apz * abz) / ab2 : 0;
  t = Math.max(0, Math.min(1, t));
  return { x: ax + abx * t, z: az + abz * t, t };
}

function reflectVelocityAcrossNormal(
  vx: number,
  vz: number,
  nx: number,
  nz: number,
  restitution: number,
): { x: number; z: number } {
  const len = Math.hypot(nx, nz) || 1;
  const nnx = nx / len;
  const nnz = nz / len;
  const dot = vx * nnx + vz * nnz;
  return {
    x: vx - 2 * dot * nnx * restitution,
    z: vz - 2 * dot * nnz * restitution,
  };
}

abstract class BaseHazard implements HazardInstance {
  abstract readonly hazardType: string;
  readonly group = new THREE.Group();
  readonly tileId: string;

  constructor(
    readonly id: string,
    readonly weight: number,
    tileGridKey: string,
  ) {
    this.tileId = tileGridKey;
  }

  update(_dt: number): void {
    void _dt;
  }

  accumulateEnvironment(
    _ctx: HazardBallContext,
    _env: HazardEnvironmental,
  ): void {
    void _ctx;
    void _env;
  }

  resolveImpulses(
    _ctx: HazardBallContext,
    _physics: SimpleBallPhysics,
    _dt: number,
  ): boolean {
    void _ctx;
    void _physics;
    void _dt;
    return false;
  }

  checkBridgeOob?(_ctx: HazardBallContext): boolean;

  dispose(): void {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry?.dispose();
        const mat = m.material;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else (mat as THREE.Material)?.dispose();
      }
    });
  }
}

class WindmillHazard extends BaseHazard {
  readonly hazardType = "windmill";
  private angle = 0;
  private readonly cx: number;
  private readonly cz: number;
  private readonly armLen: number;
  private readonly spin = 2.1;
  /** Spin target — procedural arm mesh or GLB node `windmillArm` */
  private readonly armSpin: THREE.Object3D;

  constructor(
    id: string,
    weight: number,
    tileKey: string,
    cx: number,
    cz: number,
    _rotationY: number,
  ) {
    super(id, weight, tileKey);
    this.cx = cx;
    this.cz = cz;
    this.armLen = LANE_HALF_WIDTH * 0.92;

    const glb = assetRegistry.getModelClone("hazard_windmill");
    if (glb) {
      this.group.add(glb);
      this.armSpin =
        glb.getObjectByName("windmillArm") ?? glb;
      this.group.position.set(cx, 0, cz);
      return;
    }

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.16, 1.1, 8),
      fanStone(),
    );
    pole.position.y = 0.55;
    this.group.add(pole);

    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(this.armLen * 2, 0.12, ARM_THICK),
      warmCreamStone(),
    );
    arm.position.y = 1.05;
    arm.name = "windmillArm";
    this.group.add(arm);
    this.armSpin = arm;

    this.group.position.set(cx, 0, cz);
  }

  update(dt: number): void {
    this.angle += this.spin * dt;
    this.armSpin.rotation.y = this.angle;
  }

  resolveImpulses(
    ctx: HazardBallContext,
    physics: SimpleBallPhysics,
    _dt: number,
  ): boolean {
    void _dt;
    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);
    const hx = cos * this.armLen;
    const hz = sin * this.armLen;
    const ax = this.cx - hx;
    const az = this.cz - hz;
    const bx = this.cx + hx;
    const bz = this.cz + hz;

    const { x: qx, z: qz } = closestPointOnSegment2D(
      ctx.position.x,
      ctx.position.z,
      ax,
      az,
      bx,
      bz,
    );
    const dx = ctx.position.x - qx;
    const dz = ctx.position.z - qz;
    const dist = Math.hypot(dx, dz);
    const hitR = ctx.radius + ARM_THICK * 0.55;
    if (dist > hitR) return false;

    /** Segment direction */
    const sx = bx - ax;
    const sz = bz - az;
    const sl = Math.hypot(sx, sz) || 1;
    /** Normal (push ball out) */
    let nx = -sz / sl;
    let nz = sx / sl;
    /** Push from closest point outward */
    const ox = ctx.position.x - qx;
    const oz = ctx.position.z - qz;
    if (ox * nx + oz * nz < 0) {
      nx *= -1;
      nz *= -1;
    }

    const pen = hitR - dist;
    if (pen > 0) {
      ctx.position.x += nx * pen;
      ctx.position.z += nz * pen;
    }

    const v = reflectVelocityAcrossNormal(
      physics.velocity.x,
      physics.velocity.z,
      nx,
      nz,
      0.92,
    );
    physics.velocity.x = v.x;
    physics.velocity.z = v.z;
    return true;
  }
}

class SandpitHazard extends BaseHazard {
  readonly hazardType = "sandpit";
  private readonly ox: number;
  private readonly oz: number;
  private readonly rx: number;
  private readonly rz: number;
  private readonly fx: number;
  private readonly fz: number;
  private readonly halfW: number;
  private readonly halfL: number;

  constructor(
    id: string,
    weight: number,
    tileKey: string,
    cx: number,
    cz: number,
    rotationY: number,
  ) {
    super(id, weight, tileKey);
    const b = tileBasis(rotationY);
    this.ox = cx;
    this.oz = cz;
    this.rx = b.rx;
    this.rz = b.rz;
    this.fx = b.fx;
    this.fz = b.fz;
    this.halfW = LANE_HALF_WIDTH * 0.78;
    this.halfL = TILE_SIZE * 0.38;

    const sand = new THREE.Mesh(
      new THREE.BoxGeometry(this.halfW * 2, 0.08, this.halfL * 2),
      sandGold(),
    );
    sand.position.y = -0.09;
    sand.rotation.y = rotationY;
    this.group.add(sand);
    this.group.position.set(cx, 0, cz);
  }

  accumulateEnvironment(
    ctx: HazardBallContext,
    env: HazardEnvironmental,
  ): void {
    const loc = worldToLocalXZ(
      ctx.position.x,
      ctx.position.z,
      this.ox,
      this.oz,
      this.rx,
      this.rz,
      this.fx,
      this.fz,
    );
    if (
      Math.abs(loc.lx) <= this.halfW + ctx.radius * 0.4 &&
      Math.abs(loc.lz) <= this.halfL + ctx.radius * 0.4
    ) {
      env.frictionScale = Math.max(env.frictionScale, 4.2);
    }
  }
}

class FanHazard extends BaseHazard {
  readonly hazardType = "fan";
  private readonly ox: number;
  private readonly oz: number;
  private readonly rx: number;
  private readonly rz: number;
  private readonly fx: number;
  private readonly fz: number;
  private readonly pushX: number;
  private readonly pushZ: number;

  constructor(
    id: string,
    weight: number,
    tileKey: string,
    cx: number,
    cz: number,
    rotationY: number,
    fanSign: 1 | -1,
  ) {
    super(id, weight, tileKey);
    const b = tileBasis(rotationY);
    this.ox = cx;
    this.oz = cz;
    this.rx = b.rx;
    this.rz = b.rz;
    this.fx = b.fx;
    this.fz = b.fz;
    this.pushX = b.rx * fanSign * 9;
    this.pushZ = b.rz * fanSign * 9;

    const fanGlb = assetRegistry.getModelClone("hazard_fan");
    if (fanGlb) {
      this.group.add(fanGlb);
      this.group.position.set(cx, 0, cz);
      return;
    }

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.42, 0.22, 10),
      fanStone(),
    );
    body.rotation.z = Math.PI / 2;
    body.position.set(-b.rx * 0.9, 0.25, -b.rz * 0.9);
    this.group.add(body);

    const mat = new THREE.MeshBasicMaterial({
      color: PSX_SKY_BLUE,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    });
    for (let i = 0; i < 5; i++) {
      const ribbon = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6 - i * 0.22, 0.07),
        mat,
      );
      ribbon.rotation.x = -Math.PI / 2;
      ribbon.position.set(b.fx * (1.2 + i * 0.55), 0.04, b.fz * (1.2 + i * 0.55));
      ribbon.rotation.y = rotationY;
      this.group.add(ribbon);
    }

    this.group.position.set(cx, 0, cz);
  }

  accumulateEnvironment(
    ctx: HazardBallContext,
    env: HazardEnvironmental,
  ): void {
    const loc = worldToLocalXZ(
      ctx.position.x,
      ctx.position.z,
      this.ox,
      this.oz,
      this.rx,
      this.rz,
      this.fx,
      this.fz,
    );
    const ahead = loc.lz;
    const side = loc.lx;
    if (
      ahead > 0.3 &&
      ahead < TILE_SIZE * 0.55 &&
      Math.abs(side) < LANE_HALF_WIDTH * 0.95
    ) {
      const k = 0.055;
      env.accelX += this.pushX * k;
      env.accelZ += this.pushZ * k;
    }
  }
}

class BridgeHazard extends BaseHazard {
  readonly hazardType = "bridge";
  private readonly ox: number;
  private readonly oz: number;
  private readonly rx: number;
  private readonly rz: number;
  private readonly fx: number;
  private readonly fz: number;
  private readonly narrow: number;

  constructor(
    id: string,
    weight: number,
    tileKey: string,
    cx: number,
    cz: number,
    rotationY: number,
  ) {
    super(id, weight, tileKey);
    const b = tileBasis(rotationY);
    this.ox = cx;
    this.oz = cz;
    this.rx = b.rx;
    this.rz = b.rz;
    this.fx = b.fx;
    this.fz = b.fz;
    this.narrow = BALL_RADIUS * 1.65;

    const bridgeGlb = assetRegistry.getModelClone("hazard_bridge");
    if (bridgeGlb) {
      this.group.add(bridgeGlb);
      this.group.position.set(cx, 0, cz);
      return;
    }

    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(this.narrow * 2, 0.12, TILE_SIZE * 0.88),
      warmCreamStone(),
    );
    deck.position.y = -0.02;
    deck.rotation.y = rotationY;
    this.group.add(deck);

    const gapMat = skyBlueTransparent(0.38);
    const g1 = new THREE.Mesh(
      new THREE.BoxGeometry(LANE_HALF_WIDTH * 0.85, 0.06, TILE_SIZE * 0.88),
      gapMat,
    );
    g1.position.set(-this.narrow - LANE_HALF_WIDTH * 0.45, -0.08, 0);
    g1.rotation.y = rotationY;
    const g2 = g1.clone();
    g2.position.x *= -1;
    this.group.add(g1, g2);

    this.group.position.set(cx, 0, cz);
  }

  checkBridgeOob(ctx: HazardBallContext): boolean {
    const loc = worldToLocalXZ(
      ctx.position.x,
      ctx.position.z,
      this.ox,
      this.oz,
      this.rx,
      this.rz,
      this.fx,
      this.fz,
    );
    const onTile =
      Math.abs(loc.lz) < TILE_SIZE * 0.46 &&
      Math.abs(loc.lx) < LANE_HALF_WIDTH * 1.05;
    if (!onTile) return false;
    return Math.abs(loc.lx) > this.narrow + ctx.radius * 0.25;
  }
}

class AxeHazard extends BaseHazard {
  readonly hazardType = "axe";
  private phase = 0;
  private readonly cx: number;
  private readonly cz: number;
  private readonly fx: number;
  private readonly fz: number;
  private readonly bladeAnim: THREE.Object3D;

  constructor(
    id: string,
    weight: number,
    tileKey: string,
    cx: number,
    cz: number,
    rotationY: number,
  ) {
    super(id, weight, tileKey);
    const b = tileBasis(rotationY);
    this.cx = cx;
    this.cz = cz;
    this.fx = b.fx;
    this.fz = b.fz;

    const axeGlb = assetRegistry.getModelClone("hazard_axe");
    if (axeGlb) {
      this.group.add(axeGlb);
      this.bladeAnim =
        axeGlb.getObjectByName("axeBlade") ?? axeGlb;
      this.group.position.set(cx, 0, cz);
      return;
    }

    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 0.22, 0.28),
      bladeSteel(),
    );
    blade.name = "axeBlade";
    blade.position.set(b.fx * 1.2, 0.55, b.fz * 1.2);
    this.group.add(blade);
    this.bladeAnim = blade;

    const pivot = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.65, 0.15),
      woodBrown(),
    );
    pivot.position.y = 0.85;
    this.group.add(pivot);

    this.group.position.set(cx, 0, cz);
  }

  update(dt: number): void {
    this.phase += dt * 1.55;
    this.bladeAnim.rotation.y = Math.sin(this.phase) * 0.95;
    this.bladeAnim.position.y =
      0.48 + Math.cos(this.phase) * 0.08;
  }

  resolveImpulses(
    ctx: HazardBallContext,
    physics: SimpleBallPhysics,
    _dt: number,
  ): boolean {
    void _dt;
    const swing = Math.sin(this.phase);
    const bx = this.cx + this.fx * (1.25 + swing * 0.35);
    const bz = this.cz + this.fz * (1.25 + swing * 0.35);

    const dx = ctx.position.x - bx;
    const dz = ctx.position.z - bz;
    const dist = Math.hypot(dx, dz);
    if (dist > ctx.radius + 0.55) return false;

    /** Bounce backward along -forward */
    const backX = -this.fx;
    const backZ = -this.fz;
    const speed = 9;
    physics.velocity.x = backX * speed;
    physics.velocity.z = backZ * speed;

    ctx.position.x += backX * ctx.radius * 0.35;
    ctx.position.z += backZ * ctx.radius * 0.35;
    return true;
  }
}

function tileKey(t: { gridX: number; gridZ: number }): string {
  return `${t.gridX},${t.gridZ}`;
}

export function createHazardInstances(
  specs: HazardSpawnSpec[],
  tiles: { gridX: number; gridZ: number; worldX: number; worldZ: number; rotationY: number }[],
): HazardInstance[] {
  const out: HazardInstance[] = [];

  for (const spec of specs) {
    const tile = tiles[spec.tileIndex];
    if (!tile) continue;

    const key = tileKey(tile);
    const cx = tile.worldX;
    const cz = tile.worldZ;
    const rot = tile.rotationY;

    let h: HazardInstance;
    switch (spec.kind) {
      case "windmill":
        h = new WindmillHazard(spec.id, spec.weight, key, cx, cz, rot);
        break;
      case "sandpit":
        h = new SandpitHazard(spec.id, spec.weight, key, cx, cz, rot);
        break;
      case "fan":
        h = new FanHazard(
          spec.id,
          spec.weight,
          key,
          cx,
          cz,
          rot,
          spec.fanSign ?? 1,
        );
        break;
      case "bridge":
        h = new BridgeHazard(spec.id, spec.weight, key, cx, cz, rot);
        break;
      case "axe":
        h = new AxeHazard(spec.id, spec.weight, key, cx, cz, rot);
        break;
      default: {
        const _: never = spec.kind;
        void _;
        continue;
      }
    }
    out.push(h);
  }

  return out;
}
