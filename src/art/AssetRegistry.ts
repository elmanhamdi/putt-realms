import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * Central registry for optional GLB/GLTF meshes. Gameplay never depends on assets loading.
 *
 * ─── Where to put files (Vite `public/` → served at site root) ─────────────────
 *
 *   public/assets/models/<filename>.glb
 *
 * Example full URL at dev:  http://localhost:5173/assets/models/tile_straight.glb
 *
 * Filenames must match {@link ASSET_FILENAMES} below (e.g. `tile_straight.glb`).
 * Use `.glb` (binary) or `.gltf` — update the extension in ASSET_FILENAMES if you use .gltf.
 *
 * ─── Blender / export notes ────────────────────────────────────────────────────
 *
 * - Scale models roughly to match existing procedural tiles (~lane width 4, tile ~6 units).
 * - Name interactive nodes so code can find them:
 *   - Windmill: optional mesh/object name `windmillArm` for spinning blade (else whole asset rotates on Y).
 * - Y-up; tiles expect origin near tile center on XZ, ground at Y≈0.
 *
 * Missing files: load fails silently; {@link getModelClone} keeps returning `null` and
 * procedural placeholders stay in place. The game never awaits loads on the critical path.
 */

export const ASSET_FILENAMES = {
  tile_square: "tile_square.glb",
  tile_straight: "tile_straight.glb",
  tile_curve: "tile_curve.glb",
  tile_corner: "tile_corner.glb",
  tile_start: "tile_start.glb",
  tile_hole: "tile_hole.glb",
  hazard_windmill: "hazard_windmill.glb",
  hazard_axe: "hazard_axe.glb",
  hazard_fan: "hazard_fan.glb",
  hazard_bridge: "hazard_bridge.glb",
  coin: "coin.glb",
  ball_default: "ball_default.glb",
  ball_gold: "ball_gold.glb",
} as const;

export type AssetKey = keyof typeof ASSET_FILENAMES;

/** Mutable cache: undefined = not attempted yet; null = load failed / no file */
type CacheEntry = THREE.Object3D | null | undefined;

const ALL_KEYS = Object.keys(ASSET_FILENAMES) as AssetKey[];

export class AssetRegistry {
  private readonly loader = new GLTFLoader();
  private readonly cache = new Map<AssetKey, CacheEntry>();
  private readonly inflight = new Set<AssetKey>();

  /**
   * Deep-clone of the cached template for this key, or `null` if unavailable / still loading.
   * Safe to call every frame.
   */
  getModelClone(key: AssetKey): THREE.Object3D | null {
    const entry = this.cache.get(key);
    if (entry === undefined || entry === null) return null;
    return entry.clone(true);
  }

  /** True once we know a file loaded successfully */
  isReady(key: AssetKey): boolean {
    const e = this.cache.get(key);
    return e !== undefined && e !== null;
  }

  /**
   * Fire-and-forget: loads all known assets in the background. Safe to call once at boot.
   * Never throws; failures store `null` in cache.
   */
  startBackgroundPreload(basePath = "/assets/models/"): void {
    for (const key of ALL_KEYS) {
      void this.ensureLoaded(key, basePath);
    }
  }

  private async ensureLoaded(key: AssetKey, basePath: string): Promise<void> {
    if (this.cache.has(key) || this.inflight.has(key)) return;
    this.inflight.add(key);
    const file = ASSET_FILENAMES[key];
    const url = `${basePath.replace(/\/?$/, "/")}${file}`;
    try {
      const gltf = await this.loader.loadAsync(url);
      const root = gltf.scene;
      root.name = `asset_${key}`;
      this.cache.set(key, root);
    } catch {
      this.cache.set(key, null);
    } finally {
      this.inflight.delete(key);
    }
  }
}

/** Singleton — import this from TileKit / hazards / Ball; swap in tests by constructing another registry only if you refactor injection later */
export const assetRegistry = new AssetRegistry();
