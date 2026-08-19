import { Server } from "socket.io";
import type { Server as HttpServer } from "http";
import type { UserRole } from "@prisma/client";
import prisma from "../models/prisma";
import { verifyToken } from "../utils/jwt";
import { env } from "../config/env";

let io: Server | null = null;

// Attach socket.io to the HTTP server. Authentication happens on handshake
// via the same JWT used for the REST API (passed in socket.io `auth.token`).
// Every authenticated user joins a private room named `user:<id>`; the
// notification service emits to that room for real-time delivery.
export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: env.frontendOrigins,
      methods: ["GET", "POST"],
      credentials: false,
    },
    // Small messages only (notification payloads). Keep it tight.
    maxHttpBufferSize: 1e6,
  });

  io.use(async (socket, next) => {
    const token = (socket.handshake.auth as { token?: string } | undefined)?.token;
    if (!token) {
      return next(new Error("unauthorized"));
    }
    try {
      const payload = verifyToken(token);
      const user = await prisma.user.findUnique({
        where: { id: payload.id },
        select: { deletedAt: true },
      });
      if (!user || user.deletedAt) {
        return next(new Error("unauthorized"));
      }
      socket.data.userId = payload.id;
      socket.data.role = payload.role as UserRole;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user:${socket.data.userId}`);
  });

  return io;
}

export function getIO(): Server | null {
  return io;
}

// Send a payload to a single user's private room. No-op when socket.io has
// not been initialized yet (e.g. during tests that only create the app).
export function emitToUser(userId: string, event: string, payload: unknown): void {
  io?.to(`user:${userId}`).emit(event, payload);
}