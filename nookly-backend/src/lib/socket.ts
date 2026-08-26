import { Server } from "socket.io";
import type { Server as HttpServer } from "http";
import type { UserRole } from "@prisma/client";
import prisma from "../models/prisma";
import { verifyToken } from "../utils/jwt";
import { env } from "../config/env";

let io: Server | null = null;

// Attach socket.io to the HTTP server. Two kinds of clients connect:
//   1. Authenticated users (business owners / admins) pass their JWT in
//      socket.io `auth.token`; they join a private room `user:<id>` and receive
//      real-time notifications (incl. "NEW_MESSAGE" when a customer messages
//      them).
//   2. Anonymous customers (no account) pass `auth.deviceId` instead. They join
//      a private room `device:<deviceId>` so the backend can push the owner's
//      replies to them in real time (they have no user row / notification
//      inbox, so the socket is their only delivery channel).
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
    const auth = (socket.handshake.auth ?? {}) as {
      token?: string;
      deviceId?: string;
    };

    // Authenticated user path.
    if (auth.token) {
      try {
        const payload = verifyToken(auth.token);
        const user = await prisma.user.findUnique({
          where: { id: payload.id },
          select: { deletedAt: true },
        });
        if (!user || user.deletedAt) {
          return next(new Error("unauthorized"));
        }
        socket.data.userId = payload.id;
        socket.data.role = payload.role as UserRole;
        socket.data.deviceId = undefined;
        return next();
      } catch {
        return next(new Error("unauthorized"));
      }
    }

    // Anonymous customer path — must supply a deviceId to receive replies.
    if (auth.deviceId && typeof auth.deviceId === "string" && auth.deviceId.length > 0) {
      socket.data.deviceId = auth.deviceId;
      socket.data.userId = undefined;
      socket.data.role = undefined;
      return next();
    }

    return next(new Error("unauthorized"));
  });

  io.on("connection", (socket) => {
    if (socket.data.userId) {
      socket.join(`user:${socket.data.userId}`);
    }
    if (socket.data.deviceId) {
      socket.join(`device:${socket.data.deviceId}`);
    }
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

// Send a payload to an anonymous customer's device room. Used to deliver an
// owner's reply to the customer who started the thread (customers have no
// user/notification row, so the socket is their real-time channel).
export function emitToDevice(deviceId: string, event: string, payload: unknown): void {
  if (!deviceId) return;
  io?.to(`device:${deviceId}`).emit(event, payload);
}