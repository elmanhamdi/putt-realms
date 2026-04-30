import * as THREE from "three";
import {
  assetRegistry,
  type AssetKey,
} from "../../art/AssetRegistry";
import {
  goldCoin,
  holeCupPortalSurfaceMaterial,
  holeFlagRed,
  warmCreamStone,
  woodBrown,
} from "../../art/Materials";
import { createLowPolyCylinder, snapVertexJitter } from "../../art/PsxStyle";
import type { PlacedTile } from "../LevelTypes";
import {
  TILE_SIZE,
  LANE_WIDTH,
  RAIL_HEIGHT,
  RAIL_THICKNESS,
  holeCupRadius,
} from "../TileDimensions";

/** Half-width of procedural grass deck (must match deckGrass BoxGeometry) */
const DECK_HALF_W = (LANE_WIDTH * 0.97) * 0.5;

/**
 * Lateral offset from course center to rail mesh centers so outer rail faces
 * stay inside the grass quad (older LANE_HALF_WIDTH+rail put rails past the deck).
 */
function railSideOffset(): number {
  return DECK_HALF_W - RAIL_THICKNESS * 0.5;
}
import { addSparseDecor } from "./tileDecor";
import {
  creamRailMaterial,
  cupDarkMaterial,
  grassMaterial,
} from "./tileMaterials";

function tileTypeToAssetKeys(type: PlacedTile["type"]): AssetKey[] {
  switch (type) {
    case "start":
      return ["tile_start"];
    case "straight":
      return ["tile_straight", "tile_square"];
    case "corner":
      return ["tile_corner"];
    case "curve":
      return ["tile_curve"];
    case "hole":
      return ["tile_hole"];
  }
}

/**
 * Full tile mesh from registry — skips procedural deck/rails/island for this tile.
 */
function tryAttachTileModel(parent: THREE.Object3D, tile: PlacedTile): boolean {
  for (const key of tileTypeToAssetKeys(tile.type)) {
    const node = assetRegistry.getModelClone(key);
    if (node) {
      parent.add(node);
      return true;
    }
  }
  return false;
}

function tileRng(tile: PlacedTile, salt: number): () => number {
  let s =
    tile.gridX * 1103515245 +
    tile.gridZ * 999983 +
    salt +
    (tile.type.charCodeAt(0) ?? 0);
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return (s & 0xfffffff) / 0xfffffff;
  };
}

/**
 * Modular tile visuals — swap bodies here later while keeping placement contracts.
 */
export function buildTileGroup(tile: PlacedTile): THREE.Group {
  const root = new THREE.Group();
  root.name = `tile_${tile.type}_${tile.gridX}_${tile.gridZ}`;

  if (!tryAttachTileModel(root, tile)) {
    switch (tile.type) {
      case "start":
        buildStartLocal(root, tile);
        break;
      case "straight":
        buildStraightLocal(root, tile);
        break;
      case "corner":
        buildCornerLocal(root, tile, tile.turnRight ?? true);
        break;
      case "curve":
        buildCurveLocal(root, tile, tile.turnRight ?? true);
        break;
      case "hole":
        buildHoleLocal(root, tile);
        break;
    }
  }

  addSparseDecor(root, tile);
  return root;
}

function islandUnderside(parent: THREE.Object3D, tile: PlacedTile): void {
  const rng = tileRng(tile, 7);
  const cylGeo = new THREE.CylinderGeometry(
    TILE_SIZE * 0.41,
    TILE_SIZE * 0.47,
    0.66,
    8,
    1,
    false,
  );
  snapVertexJitter(cylGeo, 0.022, rng);
  const base = new THREE.Mesh(cylGeo, woodBrown());
  base.position.y = -0.46;
  parent.add(base);

  if (rng() < 0.52) {
    const rockGeo = new THREE.DodecahedronGeometry(0.36 + rng() * 0.16, 0);
    snapVertexJitter(rockGeo, 0.032, rng);
    const rock = new THREE.Mesh(rockGeo, warmCreamStone());
    rock.position.set((rng() - 0.5) * 2.4, -0.58, (rng() - 0.5) * 2.4);
    rock.rotation.set(rng() * 6.2, rng() * 6.2, rng() * 6.2);
    parent.add(rock);
  }
}

/** Length along lane — use full TILE_SIZE so adjacent grid cells meet without gaps */
function deckGrass(parent: THREE.Object3D, lengthZ = TILE_SIZE): void {
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(LANE_WIDTH * 0.97, 0.14, lengthZ),
    grassMaterial(),
  );
  deck.position.y = -0.07;
  parent.add(deck);
}

/** Second strip along local X — fills the bend leg on corner tiles (single Z strip left gaps). */
function deckGrassAlongX(parent: THREE.Object3D): void {
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(TILE_SIZE, 0.14, LANE_WIDTH * 0.97),
    grassMaterial(),
  );
  deck.position.y = -0.07;
  parent.add(deck);
}

function parallelRails(
  parent: THREE.Object3D,
  lengthZ: number,
  mat: THREE.MeshStandardMaterial,
): void {
  const railGeo = new THREE.BoxGeometry(RAIL_THICKNESS, RAIL_HEIGHT, lengthZ);
  const y = RAIL_HEIGHT * 0.35 - 0.07;
  const xOff = railSideOffset();
  const left = new THREE.Mesh(railGeo, mat);
  left.position.set(-xOff, y, 0);
  const right = left.clone();
  right.position.x *= -1;
  parent.add(left, right);
}

function buildStraightLocal(parent: THREE.Object3D, tile: PlacedTile): void {
  deckGrass(parent);
  parallelRails(parent, TILE_SIZE, creamRailMaterial());
  islandUnderside(parent, tile);
}

function buildStartLocal(parent: THREE.Object3D, tile: PlacedTile): void {
  deckGrass(parent);
  parallelRails(parent, TILE_SIZE, creamRailMaterial());

  const peg = new THREE.Mesh(
    createLowPolyCylinder(0.07, 0.09, 0.24, 6),
    creamRailMaterial(),
  );
  peg.position.set(0, 0.1, -TILE_SIZE * 0.24);
  parent.add(peg);

  const band = new THREE.Mesh(
    new THREE.BoxGeometry(LANE_WIDTH * 0.42, 0.045, 0.14),
    creamRailMaterial(),
  );
  band.position.set(0, 0.03, -TILE_SIZE * 0.36);
  parent.add(band);

  islandUnderside(parent, tile);
}

function buildCornerLocal(
  parent: THREE.Object3D,
  tile: PlacedTile,
  turnRight: boolean,
): void {
  deckGrass(parent);
  deckGrassAlongX(parent);
  const railMat = creamRailMaterial();
  const sign = turnRight ? 1 : -1;
  const side = railSideOffset();

  const railAlongZ = new THREE.Mesh(
    new THREE.BoxGeometry(RAIL_THICKNESS, RAIL_HEIGHT, TILE_SIZE),
    railMat,
  );
  railAlongZ.position.set(
    sign * side,
    RAIL_HEIGHT * 0.35 - 0.07,
    0,
  );

  const railAlongX = new THREE.Mesh(
    new THREE.BoxGeometry(TILE_SIZE, RAIL_HEIGHT, RAIL_THICKNESS),
    railMat,
  );
  railAlongX.position.set(
    0,
    RAIL_HEIGHT * 0.35 - 0.07,
    sign * side,
  );

  parent.add(railAlongZ, railAlongX);
  islandUnderside(parent, tile);
}

function buildCurveLocal(
  parent: THREE.Object3D,
  tile: PlacedTile,
  turnRight: boolean,
): void {
  deckGrass(parent, TILE_SIZE);
  deckGrassAlongX(parent);

  const railMat = creamRailMaterial();
  const sign = turnRight ? 1 : -1;
  const segments = 6;
  const outer = railSideOffset();
  const y = RAIL_HEIGHT * 0.35 - 0.07;

  for (let i = 0; i < segments; i++) {
    const t0 = (i / segments) * (Math.PI / 2);
    const t1 = ((i + 1) / segments) * (Math.PI / 2);
    const mx = (Math.cos(t0) + Math.cos(t1)) * 0.5 * outer * sign;
    const mz = (Math.sin(t0) + Math.sin(t1)) * 0.5 * outer;
    const chunk = new THREE.Mesh(
      new THREE.BoxGeometry(RAIL_THICKNESS * 1.15, RAIL_HEIGHT, TILE_SIZE * 0.22),
      railMat,
    );
    chunk.position.set(mx, y, mz);
    const ang = (t0 + t1) * 0.5;
    chunk.rotation.y = ang * (turnRight ? 1 : -1);
    parent.add(chunk);
  }

  islandUnderside(parent, tile);
}

function addFantasyCoinsAroundCup(parent: THREE.Object3D): void {
  const mat = goldCoin();
  const n = 6;
  const ringR = holeCupRadius() * 2.35;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + 0.15;
    const coinModel = assetRegistry.getModelClone("coin");
    const coin: THREE.Object3D =
      coinModel ??
      (() => {
        const m = new THREE.Mesh(
          createLowPolyCylinder(0.13, 0.13, 0.045, 10),
          mat,
        );
        m.rotation.x = Math.PI / 2;
        m.rotation.z = ang + Math.PI * 0.5;
        return m;
      })();
    if (coinModel) {
      coin.rotation.y = ang + Math.PI * 0.5;
    }
    coin.position.set(Math.cos(ang) * ringR, 0.055, Math.sin(ang) * ringR);
    parent.add(coin);
  }
}

function buildHoleLocal(parent: THREE.Object3D, tile: PlacedTile): void {
  deckGrass(parent);

  const railMat = creamRailMaterial();
  parallelRails(parent, TILE_SIZE, railMat);

  const cupR = holeCupRadius();

  /** Grass deck top is y=0 — portal must sit slightly above or it renders inside the deck and disappears */
  const rim = new THREE.Mesh(
    new THREE.RingGeometry(cupR * 0.76, cupR * 1.12, 28),
    cupDarkMaterial(),
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.005;
  parent.add(rim);

  const cup = new THREE.Mesh(
    new THREE.CircleGeometry(cupR * 0.74, 32),
    holeCupPortalSurfaceMaterial(),
  );
  cup.rotation.x = -Math.PI / 2;
  cup.position.y = 0.004;
  cup.renderOrder = 3;
  cup.name = "HolePortalSurface";
  parent.add(cup);

  const pin = new THREE.Mesh(
    createLowPolyCylinder(0.034, 0.045, 0.58, 8),
    creamRailMaterial(),
  );
  pin.position.y = 0.32;
  parent.add(pin);

  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.44, 0.3),
    holeFlagRed(),
  );
  flag.position.set(0.24, 0.46, 0);
  flag.rotation.y = Math.PI / 2;
  parent.add(flag);

  addFantasyCoinsAroundCup(parent);
  islandUnderside(parent, tile);
}
