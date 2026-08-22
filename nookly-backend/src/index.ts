/// <reference path="./types/express.d.ts" />
import { createServer } from "http";
import { createApp } from "./app";
import { initSocket } from "./lib/socket";
import { env } from "./config/env";

const app = createApp();
const server = createServer(app);

initSocket(server);

// Bind to 0.0.0.0 so the app is reachable inside the Render container (and any
// containerized host), not just loopback. Render assigns PORT dynamically via
// process.env, which env.port already reads.
server.listen(env.port, "0.0.0.0", () => {
  console.log(`Nookly backend listening on 0.0.0.0:${env.port}`);
});