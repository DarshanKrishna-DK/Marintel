import "dotenv/config";

import { createApp } from "./app";
import { env } from "./env";
import { createRedisClient } from "./redis";

const redis = createRedisClient(env);
const app = createApp({ env, redis });

app.listen(env.PORT, () => {
  console.log(`Marintel backend listening on http://localhost:${env.PORT}`);
});

