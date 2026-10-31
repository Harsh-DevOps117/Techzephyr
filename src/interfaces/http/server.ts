import { createApp } from "./app.js";
import { config } from "../../infrastructure/config/env.js";
import { logger } from "../../infrastructure/logging/logger.js";

const server = createApp().listen(config.PORT, () => logger.info("api.listening", { port: config.PORT }));
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
