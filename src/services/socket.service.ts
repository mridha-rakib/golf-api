import { logger } from "@/middlewares/pino-logger";
import { AuthUtil } from "@/modules/auth/auth.utils";
import { ChatService } from "@/modules/chat/chat.service";
import type { UserResponse } from "@/modules/user/user.type";
import { randomUUID } from "crypto";
import { Server as HttpServer } from "http";
import { Server, type Socket } from "socket.io";

type AuthedSocket = Socket & {
  userId?: string;
  email?: string;
};

type JoinPayload = { convId?: string };
type SendMessagePayload = {
  convId?: string;
  text?: string;
  mediaUrl?: string;
  mediaUrls?: string[];
  tempId?: string; // optional client-generated id for optimistic UI
};

type ReactMessagePayload = {
  messageId?: string;
  emoji?: string;
  convId?: string;
};

type OutgoingMessage = {
  id: string;
  convId: string;
  text: string;
  mediaUrls: string[];
  senderId: string;
  sender?: UserResponse | null;
  mentionedUserIds?: string[];
  reactions?: Array<{ userId: string; emoji: string; reactedAt: Date }>;
  sentAt: string;
  tempId?: string;
};

const roomName = (convId: string) => `conv:${convId}`;

export class SocketService {
  private io: Server;
  private chatService: ChatService;

  constructor(server: HttpServer) {
    this.io = new Server(server, {
      cors: { origin: true, credentials: true },
      transports: ["websocket", "polling"],
    });
    this.chatService = new ChatService();
    this.register();
  }

  private register() {
    this.io.use((socket: AuthedSocket, next) => {
      try {
        const token =
          (socket.handshake.query?.token as string | undefined) ||
          (socket.handshake.auth?.token as string | undefined) ||
          (
            socket.handshake.headers.authorization as string | undefined
          )?.replace(/^Bearer\\s+/i, "");

        if (!token) {
          return next(new Error("Authentication token required"));
        }

        const payload = AuthUtil.verifyAccessToken(token);
        socket.userId = payload.userId;
        socket.email = payload.email;
        return next();
      } catch (err) {
        return next(new Error("Authentication failed"));
      }
    });

    this.io.on("connection", (socket: AuthedSocket) => {
      if (!socket.userId) {
        socket.disconnect();
        return;
      }

      logger.info({ userId: socket.userId }, "Socket connected");

      // Join personal room for possible future use.
      socket.join(`user:${socket.userId}`);

      socket.on("join", (payload: JoinPayload, cb?: (resp: any) => void) => {
        try {
          const convId = payload?.convId?.trim();
          if (!convId) {
            throw new Error("convId is required");
          }
          socket.join(roomName(convId));
          cb?.({ ok: true });
        } catch (err: any) {
          cb?.({ ok: false, error: err.message ?? "Failed to join" });
        }
      });

      socket.on(
        "send-msg",
        (payload: SendMessagePayload, cb?: (resp: any) => void) => {
          try {
            const convId = payload?.convId?.trim();
            const text = payload?.text?.trim() ?? "";
            const mediaUrls =
              payload?.mediaUrls?.filter(
                (u) => typeof u === "string" && u.trim(),
              ) || (payload?.mediaUrl ? [payload.mediaUrl] : []);

            if (!convId) throw new Error("convId is required");
            if (!text && mediaUrls.length === 0) {
              throw new Error("Message text or media is required");
            }

            const type = mediaUrls.length > 0 ? "image" : "text";

            this.chatService
              .sendMessageToThread(socket.userId!, {
                threadId: convId,
                type,
                text,
                imageUrl: mediaUrls[0],
              })
              .then(({ message }) => {
                const outgoing: OutgoingMessage = {
                  id: message._id,
                  convId,
                  text: message.text ?? "",
                  mediaUrls: mediaUrls,
                  senderId: socket.userId!,
                  sender: message.sender ?? null,
                  mentionedUserIds: message.mentionedUserIds ?? [],
                  reactions: message.reactions ?? [],
                  sentAt: message.createdAt.toISOString
                    ? message.createdAt.toISOString()
                    : new Date().toISOString(),
                  tempId: payload?.tempId,
                };
                this.io.to(roomName(convId)).emit("new-msg", outgoing);
                cb?.({ ok: true, message: outgoing });
              })
              .catch((err) => {
                cb?.({
                  ok: false,
                  error: err?.message ?? "Failed to send message",
                });
              });
          } catch (err: any) {
            cb?.({ ok: false, error: err.message ?? "Failed to send message" });
          }
        },
      );

      socket.on(
        "react-msg",
        (payload: ReactMessagePayload, cb?: (resp: any) => void) => {
          try {
            const messageId = payload?.messageId?.trim();
            const emoji = payload?.emoji?.trim();

            if (!messageId) throw new Error("messageId is required");

            this.chatService
              .reactToMessage(socket.userId!, messageId, emoji)
              .then(({ action, message }) => {
                const convId = message.threadId;
                const outgoing = {
                  action,
                  messageId: message._id,
                  convId,
                  reactions: message.reactions ?? [],
                };
                this.io.to(roomName(convId)).emit("msg-reacted", outgoing);
                cb?.({ ok: true, data: outgoing });
              })
              .catch((err) => {
                cb?.({
                  ok: false,
                  error: err?.message ?? "Failed to react to message",
                });
              });
          } catch (err: any) {
            cb?.({ ok: false, error: err.message ?? "Failed to react" });
          }
        },
      );

      // Heartbeat handling
      socket.on("ping", (_data, cb?: () => void) => {
        cb?.();
        socket.emit("pong");
      });

      socket.on("disconnect", (reason) => {
        logger.info({ userId: socket.userId, reason }, "Socket disconnected");
      });
    });
  }
}

export const createSocketServer = (server: HttpServer) => {
  return new SocketService(server);
};
