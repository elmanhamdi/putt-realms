import type { HazardKind } from "../hazards/HazardTypes";

export type TileType = "start" | "straight" | "curve" | "corner" | "hole";

export interface HazardSpawnSpec {
  id: string;
  kind: HazardKind;
  tileIndex: number;
  weight: number;
  /** Only for fan kind */
  fanSign?: 1 | -1;
}

/** Cardinal directions on the logical grid (+Z forward default). */
export enum GridDir {
  N = 0,
  E = 1,
  S = 2,
  W = 3,
}

export interface PlacedTile {
  type: TileType;
  /** Logical grid cell (integer coordinates). */
  gridX: number;
  gridZ: number;
  /** World-space origin for this tile's root group (tile center on xz). */
  worldX: number;
  worldZ: number;
  /** Rotation around Y so geometry aligns with path (radians). */
  rotationY: number;
  /** Corner / curve tiles: mesh mirror for left vs right bends */
  turnRight?: boolean;
}

/** Axis-aligned playable bounds in world space (xz), for physics clamping. */
export interface LevelWorldBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface GeneratedLevel {
  id: string;
  levelIndex: number;
  /** Computed integer difficulty 0–10 */
  difficultyScore: number;
  /** Rounded target used for ±1 matching */
  targetDifficulty: number;
  /** True when no candidate landed within ±1 after max attempts */
  imperfectDifficulty?: boolean;
  hazardSpecs: HazardSpawnSpec[];
  tiles: PlacedTile[];
  startPosition: { x: number; y: number; z: number };
  holePosition: { x: number; y: number; z: number };
  bounds: LevelWorldBounds;
}
