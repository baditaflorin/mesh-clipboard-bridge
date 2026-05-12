import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-clipboard-bridge",
  description: "Share text and snippets between your own phones and laptops — no cable, no cloud",
  accentHex: "#7b8cff",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
