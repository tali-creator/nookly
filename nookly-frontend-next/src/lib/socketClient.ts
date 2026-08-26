import { API_BASE_URL } from "./config";

/* Thin loader for the socket.io client served by the backend at
   /socket.io/socket.io.js. The backend shares the same origin as the API, so we
   point at API_BASE_URL. Exposes just enough of the surface we use. */
export type IoSocket = {
  on: (event: string, cb: (...args: unknown[]) => void) => void;
  disconnect: () => void;
};

type IoFactory = (url?: string, opts?: unknown) => IoSocket;

let cached: IoFactory | null = null;

export function loadSocketIo(): Promise<IoFactory> {
  const w = window as unknown as { io?: IoFactory };
  if (w.io) return Promise.resolve(w.io);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = API_BASE_URL + "/socket.io/socket.io.js";
    s.onload = () => {
      if (w.io) resolve(w.io);
      else reject(new Error("socket.io client failed to initialize"));
    };
    s.onerror = () => reject(new Error("Could not load socket.io client"));
    document.head.appendChild(s);
  });
}

/* Connect as an anonymous customer, identified only by deviceId. Customers have
   no account, so this is how they receive the owner's replies in real time. */
export async function connectAsDevice(deviceId: string): Promise<IoSocket> {
  const io = await loadSocketIo();
  return io(API_BASE_URL, {
    auth: { deviceId },
    transports: ["websocket", "polling"],
  });
}

/* Connect as an authenticated user (business owner / admin) using the JWT. */
export async function connectAsUser(token: string): Promise<IoSocket> {
  const io = await loadSocketIo();
  return io(API_BASE_URL, {
    auth: { token },
    transports: ["websocket", "polling"],
  });
}
