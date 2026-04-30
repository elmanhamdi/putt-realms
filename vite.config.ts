import { defineConfig } from "vite";

/**
 * Project Pages URL: https://vitorfgd.github.io/putt-realms/
 * CI sets GITHUB_ACTIONS so asset paths resolve under /putt-realms/.
 */
export default defineConfig({
  base: process.env.GITHUB_ACTIONS === "true" ? "/putt-realms/" : "/",
  root: ".",
  server: {
    host: true,
  },
});
