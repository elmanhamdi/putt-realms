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

const gameCanvas = canvas;
const gameHud = hud;

let game: Game;

async function bootstrap(): Promise<void> {
  assetRegistry.startBackgroundPreload();
  await assetRegistry.preloadAsset("hole_flag");
  preloadHolePortalTexture();
  game = new Game(gameCanvas, gameHud);

  let gameStarted = false;
  function dismissTitleScreen(): void {
    if (gameStarted) return;
    gameStarted = true;
    titleScreen?.classList.add("title-screen--hidden");
    titleScreen?.setAttribute("aria-hidden", "true");
    appRoot?.classList.remove("app--pre-game");
    game.primeAudioOnTitleScreen();
    game.start();
  }

  if (titleScreen) {
    appRoot?.classList.add("app--pre-game");
    game.presentInitialFrame();
    /** First touch on title = user gesture → BGM can start before pointerup (still on tap-to-play). */
    titleScreen.addEventListener("pointerdown", () => {
      game.primeAudioOnTitleScreen();
    });
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
}

void bootstrap().catch((err) => {
  console.error("[bootstrap]", err);
});
