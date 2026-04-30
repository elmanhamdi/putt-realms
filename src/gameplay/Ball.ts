import * as THREE from "three";
import { createDefaultBallMaterial } from "../art/Materials";
import type { BallCosmeticId } from "../cosmetics/cosmeticTypes";
import { BALL_RADIUS } from "../core/Constants";

function disposeLoadedSubtree(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.geometry?.dispose();
      const mat = m.material;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else (mat as THREE.Material | undefined)?.dispose();
    }
  });
}

/**
 * Procedural sphere + tiled dimple albedo/bump (see Materials.ts).
 */
export class Ball extends THREE.Group {
  static readonly RADIUS = BALL_RADIUS;

  readonly visualRoot = new THREE.Group();
  private primaryMesh: THREE.Mesh | null = null;

  constructor() {
    super();
    this.add(this.visualRoot);
    this.rebuildVisual();
  }

  syncVisualFromRegistry(_cosmetic: BallCosmeticId): void {
    this.rebuildVisual();
  }

  private rebuildVisual(): void {
    while (this.visualRoot.children.length) {
      const ch = this.visualRoot.children[0];
      this.visualRoot.remove(ch);
      disposeLoadedSubtree(ch);
    }
    this.primaryMesh = null;

    const geo = new THREE.SphereGeometry(Ball.RADIUS, 48, 40);
    const mesh = new THREE.Mesh(geo, createDefaultBallMaterial().clone());
    mesh.position.y = Ball.RADIUS;
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    this.visualRoot.add(mesh);
    this.primaryMesh = mesh;
  }

  setSinkProgress(t: number): void {
    const k = Math.min(1, Math.max(0, t));
    const s = 1 - k * 0.94;
    this.visualRoot.scale.setScalar(s);
    this.visualRoot.position.y = Ball.RADIUS * (1 - k * 1.15);
  }

  resetVisual(): void {
    this.visualRoot.scale.setScalar(1);
    this.visualRoot.position.y = 0;
  }

  /** Multiplies map — blend slightly toward white so tint doesn’t flatten dimples */
  applyCosmeticTint(hex: number): void {
    if (!this.primaryMesh) return;
    const m = this.primaryMesh.material as THREE.MeshBasicMaterial;
    const c = new THREE.Color(hex);
    c.lerp(new THREE.Color(0xffffff), 0.18);
    m.color.copy(c);
  }
}
