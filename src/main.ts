import "./style.css";
import { assetRegistry } from "./art/AssetRegistry";
import { preloadHolePortalTexture } from "./art/Materials";
import { Game } from "./core/Game";

const canvas = document.querySelector<HTMLCanvasElement>("#game");
const hud = document.querySelector<HTMLElement>("#hud");
const titleScreen = document.querySelector<HTMLElement>("#title-screen");
const appRoot = document.querySelector<HTMLElement>("#app");

if (!canvas || !hud) {
  throw new Error("Missing #game canvas or #hud overlay");
}

assetRegistry.startBackgroundPreload();
preloadHolePortalTexture();

const game = new Game(canvas, hud);

let gameStarted = false;
function dismissTitleScreen(): void {
  if (gameStarted) return;
  gameStarted = true;
  titleScreen?.classList.add("title-screen--hidden");
  titleScreen?.setAttribute("aria-hidden", "true");
  appRoot?.classList.remove("app--pre-game");
  game.start();
}

if (titleScreen) {
  appRoot?.classList.add("app--pre-game");
  game.presentInitialFrame();
  const onActivate = (e: Event): void => {
    e.preventDefault();
    dismissTitleScreen();
  };
  titleScreen.addEventListener("pointerup", onActivate);
  titleScreen.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      dismissTitleScreen();
    }
  });
  queueMicrotask(() => titleScreen.focus());
} else {
  game.start();
}
