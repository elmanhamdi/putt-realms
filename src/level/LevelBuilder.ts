import * as THREE from "three";
import type { GeneratedLevel } from "./LevelTypes";
import { buildTileGroup } from "./tiles/TileKit";

export class LevelBuilder {
  buildInto(
    parent: THREE.Object3D,
    level: GeneratedLevel,
    _rng: () => number = Math.random,
  ): void {
    void _rng;
    const course = new THREE.Group();
    course.name = `Course_${level.id}`;

    for (const tile of level.tiles) {
      const piece = buildTileGroup(tile);
      piece.position.set(tile.worldX, 0, tile.worldZ);
      piece.rotation.y = tile.rotationY;
      course.add(piece);
    }

    parent.add(course);
  }
}
