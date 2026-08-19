/// <reference path="./types/express.d.ts" />
import { createServer } from "http";
import { createApp } from "./app";
import { initSocket } from "./lib/socket";
import { env } from "./config/env";

const app = createApp();
const server = createServer(app);

initSocket(server);

server.listen(env.port, () => {
  console.log(`Nookly backend listening on http://localhost:${env.port}`);
});