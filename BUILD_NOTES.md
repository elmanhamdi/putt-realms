# Putt Realms — Build & Feature Notes

Web mini-golf prototype: **Three.js** + **Vite** + **TypeScript**. Endless procedural holes with a fixed portrait gameplay aspect, HTML HUD overlay, and optional GLTF props from `public/`.

---

## Core gameplay

- **Tap-to-play** title screen (unlocks audio on first gesture; BGM can start on pointer-down before release).
- **Drag-to-aim** on the canvas: pull back for direction and power; release to shoot.
- **Stroke counting** per hole; HUD shows level, strokes, and a **0–10 difficulty** rating derived from course metrics (path length, hazard weight, tile complexity, turns).
- **Simple ball physics** on the course: collisions with tiles, rails, bounds, and hazards; hole sink uses a short celebration sequence (orbit / pull toward cup) before the next level loads.
- **Out of bounds**: ball can leave the playable slab; short message, then replay from the tee without advancing the hole.
- **Camera**: hole **preview** pan, transition to **ball-follow** view (camera sits behind the ball toward the cup), optional **orbit** while aiming, and a dedicated **hole-out** moment.

---

## Procedural content

- Levels are **generated** from path logic (straights, curves, corners, start/hole tiles), not hand-authored JSON.
- **Hazard types** (weighted spawns along the path): **windmill**, **sandpit**, **fan**, **bridge**, **axe**, **boost**.
- **Boost pads** on the fairway: **blue chevron / speed stripes** baked into the grass tile; rolling through them applies a forward **speed impulse** along the lane.
- **Spinning & motion hazards**: **windmill** — continuously **rotating arm**, collision follows the blade (procedural or GLB); **axe** — **orbiting blade** that spins and **knocks the ball backward** on contact; **fan** — **side-wind** in a ribbon-marked lane (constant push, sign may flip per spawn).
- **Sky / backdrop**: layered clouds and per-level background treatment for readability.
- **Tiles**: instanced kit (square, straight, curve, corner, start, hole); optional **GLB/GLTF** meshes via `AssetRegistry` (e.g. windmill, bridge, ball variants, **hole flag** — falls back to procedural art if files are missing).

---

## Meta & economy

- **Coins** (persisted in **localStorage**): earned mainly from **hole-in-one** payouts scaled by difficulty.
- **Hole-in-one streak**: consecutive HIOs increase a **multiplier** on the next HIO payout (capped steps up to 2×); any non-HIO completion **resets** the streak.
- **HUD toasts**: hole-in-one, clean shot (two strokes), out-of-bounds, free skip reasons.
- **Skip level**: appears after the first stroke on a hole; **coin cost** scales with difficulty. **Free skip** paths exist for imperfect generator matches or stuck-state detection (slow near hole for too long).
- **Coin pill** in the HUD shows balance; the small **“+”** control is present in markup for future bonuses / shop entry (not wired in gameplay yet).

---

## Cosmetics (stub)

- **Ball cosmetics** catalog (Classic Ivory default; Gold, Emerald, Ruby, Sapphire) with **equipped** and **unlocked** sets persisted locally. Unlock/shop flow is reserved for later; `unlock()` exists for future hooks.

---

## Audio

- One-shots: **hit**, **ball bump** (throttled), **bell** on hole-out.
- **BGM**: three tracks rotated by **level index** during play; respects browser autoplay policy until the user interacts.

---

## Art direction

- Stylized **low-poly / PS1-adjacent** cues (e.g. low-segment primitives, chunky pixel-style textures where used) plus readable grass / rails / portal-style cup presentation.

---

*This file is a living summary for releases and onboarding; update it when major gameplay or pipeline behavior changes.*
