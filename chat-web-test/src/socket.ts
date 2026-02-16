import { io, Socket } from "socket.io-client";

const DEFAULT_API_BASE = "http://localhost:3000/api/v1";

const buildSocketUrl = () => {
  const raw =
    (import.meta as any).env.VITE_SOCKET_BASE ||
    (import.meta as any).env.VITE_API_BASE ||
    DEFAULT_API_BASE;

  try {
    const parsed = new URL(raw);
    // strip any path like /api/v1 so we connect to root namespace
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return raw.replace(/\/api.*$/, "").replace(/\/$/, "");
  }
};

const socketPath =
  (import.meta as any).env.VITE_SOCKET_PATH &&
  String((import.meta as any).env.VITE_SOCKET_PATH).trim().length > 0
    ? (import.meta as any).env.VITE_SOCKET_PATH
    : "/socket.io";

export const createSocket = (token: string): Socket =>
  io(buildSocketUrl(), {
    auth: { token },
    transports: ["websocket", "polling"],
    path: socketPath,
    withCredentials: true,
  });
