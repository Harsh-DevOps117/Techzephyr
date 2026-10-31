import { createApp } from "./app.js";
import { config } from "../../infrastructure/config/env.js";

const server = createApp().listen(config.PORT, () => console.log(`API listening on :${config.PORT}`));
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
