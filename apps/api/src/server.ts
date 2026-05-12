import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { startMelhorEnvioTrackingSyncJob } from "./lib/tracking-sync.js";

const app = createApp();

app.listen(env.PORT, () => {
  console.info(`[api] LM-3D API listening on port ${env.PORT}`);
  startMelhorEnvioTrackingSyncJob();
});
