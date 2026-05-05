import { createApp } from "./app.js";
import { env } from "./config/env.js";

const app = createApp();

app.listen(env.PORT, () => {
  console.info(`[api] LM-3D API listening on port ${env.PORT}`);
});
