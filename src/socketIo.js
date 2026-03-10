const socketIo = require("socket.io");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Offer = require("./models/Offer");
const UserPost = require("./models/UserPost");

const users = {};
const lastPong = {};
let io;

const SOCKET_DEBUG_ENABLED =
  String(process.env.SOCKET_DEBUG || "").trim().toLowerCase() === "true";

const maskToken = (tokenValue) => {
  const token = String(tokenValue || "").trim();
  if (!token) return "(empty)";
  if (token.length <= 18) return `${token} (len=${token.length})`;
  return `${token.slice(0, 12)}...${token.slice(-6)} (len=${token.length})`;
};

const tokenSignature = (tokenValue) => {
  const token = String(tokenValue || "");
  if (!token) return "none";
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16)}:len${token.length}`;
};

const socketDebug = (message, payload = {}) => {
  if (!SOCKET_DEBUG_ENABLED) return;
  console.log(`[socket-debug] ${message}`, payload);
};

const normalizeToken = (tokenValue) =>
  String(tokenValue || "")
    .replace(/^Bearer\s+/i, "")
    .trim();

const getHandshakeTokenMeta = (socket) => {
  const authToken = normalizeToken(socket?.handshake?.auth?.token);
  if (authToken) return { token: authToken, source: "auth.token" };

  const queryToken = normalizeToken(socket?.handshake?.query?.token);
  if (queryToken) return { token: queryToken, source: "query.token" };

  const headerToken = normalizeToken(socket?.handshake?.headers?.authorization);
  if (headerToken) return { token: headerToken, source: "headers.authorization" };

  const rawCookie = String(socket?.handshake?.headers?.cookie || "");
  const authCookieName = process.env.AUTH_COOKIE_NAME || "access_token";
  const cookieTokenPair = rawCookie
    .split(";")
    .map((cookiePart) => cookiePart.trim())
    .find((cookiePart) => cookiePart.startsWith(`${authCookieName}=`));
  if (!cookieTokenPair) return { token: "", source: "none" };
  const [, encodedCookieToken = ""] = cookieTokenPair.split("=");
  const cookieToken = normalizeToken(decodeURIComponent(encodedCookieToken));
  if (!cookieToken) return { token: "", source: "none" };
  return { token: cookieToken, source: `cookie.${authCookieName}` };
};

const getRecipientSockets = (recipient) => users[String(recipient)] || [];

const normalizeOrigin = (originValue) => {
  const raw = String(originValue || "").trim();
  if (!raw) return "";

  try {
    const parsed = new URL(raw);
    const protocol = String(parsed.protocol || "").toLowerCase();
    const hostname = String(parsed.hostname || "").toLowerCase();
    const port = String(parsed.port || "");
    const isDefaultPort =
      (protocol === "https:" && (port === "" || port === "443")) ||
      (protocol === "http:" && (port === "" || port === "80"));
    const normalizedPort = isDefaultPort ? "" : `:${port}`;
    return `${protocol}//${hostname}${normalizedPort}`;
  } catch (_) {
    return raw.replace(/\/+$/, "").toLowerCase();
  }
};

const normalizeId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    if (value._id) return String(value._id);
    if (value.id) return String(value.id);
  }
  return String(value);
};

const canUsersExchangeMessage = async ({ postId, senderId, recipientId }) => {
  const normalizedPostId = normalizeId(postId);
  const normalizedSenderId = normalizeId(senderId);
  const normalizedRecipientId = normalizeId(recipientId);

  if (!mongoose.Types.ObjectId.isValid(normalizedPostId)) return false;
  if (!mongoose.Types.ObjectId.isValid(normalizedSenderId)) return false;
  if (!mongoose.Types.ObjectId.isValid(normalizedRecipientId)) return false;

  const post = await UserPost.findById(normalizedPostId)
    .select("owner offerSelected")
    .populate({ path: "offerSelected", select: "owner" })
    .lean();
  if (!post?.owner) return false;

  const participantIds = new Set([String(post.owner)]);
  if (post?.offerSelected?.owner) {
    participantIds.add(String(post.offerSelected.owner));
  }

  const offers = await Offer.find({ post: normalizedPostId, isDeleted: false })
    .select("owner")
    .lean();
  offers.forEach((offer) => {
    if (offer?.owner) participantIds.add(String(offer.owner));
  });

  return (
    participantIds.has(String(normalizedSenderId)) &&
    participantIds.has(String(normalizedRecipientId))
  );
};

const setupSocket = (server, allowedOrigins = []) => {
  const allowedOriginsNormalized = new Set(
    allowedOrigins.map((origin) => normalizeOrigin(origin)).filter(Boolean),
  );

  socketDebug("setup", {
    allowedOrigins,
    allowedOriginsCount: allowedOrigins.length,
    allowedOriginsNormalized: Array.from(allowedOriginsNormalized),
  });

  const isAllowedOrigin = (origin) => {
    if (!origin) return true;
    return allowedOriginsNormalized.has(normalizeOrigin(origin));
  };

  io = socketIo(server, {
    cors: {
      origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
          socketDebug("cors_origin_allowed", {
            origin: origin || "(no-origin)",
            normalizedOrigin: normalizeOrigin(origin),
          });
          return callback(null, true);
        }
        socketDebug("cors_origin_rejected", {
          origin: origin || "(no-origin)",
          normalizedOrigin: normalizeOrigin(origin),
          allowedOriginsCount: allowedOrigins.length,
        });
        return callback(new Error("Not allowed by CORS"));
      },
      methods: ["GET", "POST", "OPTIONS", "PUT", "PATCH", "DELETE"],
      credentials: true,
    },
  });

  io.use((socket, next) => {
    let token = "";
    let source = "none";

    try {
      const tokenMeta = getHandshakeTokenMeta(socket);
      token = tokenMeta.token;
      source = tokenMeta.source;

      socketDebug("handshake_received", {
        socketId: socket.id,
        origin: socket?.handshake?.headers?.origin || "(no-origin)",
        source,
        tokenPreview: maskToken(token),
        tokenSignature: tokenSignature(token),
        hasAuthPayload: Boolean(socket?.handshake?.auth?.token),
        hasQueryToken: Boolean(socket?.handshake?.query?.token),
        hasAuthorizationHeader: Boolean(socket?.handshake?.headers?.authorization),
        hasCookieHeader: Boolean(socket?.handshake?.headers?.cookie),
        transport: socket?.handshake?.query?.transport || null,
      });

      if (!token) {
        console.warn("Socket rejected: missing token");
        return next(new Error("Unauthorized"));
      }
      const { user } = jwt.verify(token, process.env.SECRET_WORD);
      if (!user?.id) {
        console.warn("Socket rejected: token without user id");
        return next(new Error("Unauthorized"));
      }
      socket.userId = String(user.id);
      socket.userRole = user.role;
      socketDebug("handshake_authorized", {
        socketId: socket.id,
        source,
        tokenPreview: maskToken(token),
        tokenSignature: tokenSignature(token),
        userId: socket.userId,
        role: socket.userRole,
      });
      return next();
    } catch (error) {
      console.warn("Socket rejected: invalid token", error?.message);
      socketDebug("handshake_rejected_invalid_token", {
        socketId: socket.id,
        source,
        tokenPreview: maskToken(token),
        tokenSignature: tokenSignature(token),
        message: error?.message,
      });
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const userId = String(socket.userId);
    if (!users[userId]) users[userId] = [];
    users[userId].push(socket.id);
    lastPong[socket.id] = Date.now();
    socketDebug("connection_open", {
      socketId: socket.id,
      userId,
      role: socket.userRole,
      totalSocketsForUser: users[userId].length,
    });

    socket.on("newUser", (claimedUserId) => {
      socketDebug("event_newUser", {
        socketId: socket.id,
        authenticatedUserId: userId,
        claimedUserId: claimedUserId ? String(claimedUserId) : null,
      });
      if (claimedUserId && String(claimedUserId) !== userId) {
        console.warn(
          `Socket ${socket.id} attempted to claim ${claimedUserId} but is authenticated as ${userId}`,
        );
      }
    });

    socket.on("pongCheck", () => {
      lastPong[socket.id] = Date.now();
      socketDebug("event_pongCheck", {
        socketId: socket.id,
        userId,
        timestamp: lastPong[socket.id],
      });
    });

    socket.on("privateMessage", async ({ text, recipient, postId }, callback) => {
      const senderId = String(socket.userId);
      const recipientId = normalizeId(recipient);
      const normalizedPostId = normalizeId(postId);
      socketDebug("event_privateMessage_received", {
        socketId: socket.id,
        senderId,
        recipientId,
        postId: normalizedPostId,
        textLength: String(text || "").length,
      });

      if (!text || !recipientId || !normalizedPostId) {
        socketDebug("event_privateMessage_rejected_payload", {
          socketId: socket.id,
          senderId,
          recipientId,
          postId: normalizedPostId,
        });
        callback?.({ status: "error", reason: "invalid_payload" });
        return;
      }

      try {
        const authorized = await canUsersExchangeMessage({
          postId: normalizedPostId,
          senderId,
          recipientId,
        });
        if (!authorized) {
          socketDebug("event_privateMessage_rejected_unauthorized", {
            socketId: socket.id,
            senderId,
            recipientId,
            postId: normalizedPostId,
          });
          callback?.({ status: "error", reason: "unauthorized" });
          return;
        }

        const sockets = getRecipientSockets(recipientId);
        let sent = false;

        sockets.forEach((socketId) => {
          const targetSocket = io.sockets.sockets.get(socketId);
          if (targetSocket?.connected) {
            targetSocket.emit("privateMessage", {
              text,
              sender: senderId,
              postId: normalizedPostId,
            });
            sent = true;
          }
        });

        socketDebug("event_privateMessage_delivery_result", {
          socketId: socket.id,
          senderId,
          recipientId,
          postId: normalizedPostId,
          recipientSocketCount: sockets.length,
          sent,
        });
        callback?.(
          sent
            ? { status: "ok" }
            : { status: "error", reason: "recipient_not_connected" },
        );
      } catch (error) {
        socketDebug("event_privateMessage_server_error", {
          socketId: socket.id,
          senderId,
          recipientId,
          postId: normalizedPostId,
          message: error?.message,
        });
        callback?.({ status: "error", reason: "server_error" });
      }
    });

    socket.on("disconnect", (reason) => {
      if (users[userId]) {
        users[userId] = users[userId].filter((id) => id !== socket.id);
        if (users[userId].length === 0) delete users[userId];
      }
      delete lastPong[socket.id];
      socketDebug("connection_closed", {
        socketId: socket.id,
        userId,
        reason,
        remainingSocketsForUser: users[userId]?.length || 0,
      });
    });
  });

  setInterval(() => {
    const timeout = 60000;
    for (const [socketId, lastTime] of Object.entries(lastPong)) {
      const now = Date.now();
      if (now - lastTime > timeout) {
        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
          socketDebug("heartbeat_timeout_disconnect", {
            socketId,
            lastPongAgoMs: now - lastTime,
          });
          socket.disconnect(true);
        }
      } else {
        socketDebug("heartbeat_ping", {
          socketId,
          lastPongAgoMs: now - lastTime,
        });
        io.to(socketId).emit("pingCheck");
      }
    }
  }, 45000);
};

const notifyOffer = (recipient, newOffer) => {
  if (!io) {
    socketDebug("notify_offer_skipped_no_io", { recipient: String(recipient) });
    return;
  }
  const sockets = getRecipientSockets(recipient);
  sockets.forEach((socketId) => {
    const targetSocket = io.sockets.sockets.get(socketId);
    if (targetSocket?.connected) {
      targetSocket.emit("offerNotification", newOffer);
    }
  });
};

const OfferSelected = (recipient, postOfferSelected) => {
  if (!io) {
    socketDebug("offer_selected_skipped_no_io", { recipient: String(recipient) });
    return;
  }
  const sockets = getRecipientSockets(recipient);
  sockets.forEach((socketId) => {
    const targetSocket = io.sockets.sockets.get(socketId);
    if (targetSocket?.connected) {
      targetSocket.emit("OfferSelected", postOfferSelected);
    }
  });
};

const notifyNewStatus = (recipient, newPostStatus) => {
  if (!io) {
    socketDebug("notify_status_skipped_no_io", { recipient: String(recipient) });
    return;
  }
  const sockets = getRecipientSockets(recipient);
  sockets.forEach((socketId) => {
    const targetSocket = io.sockets.sockets.get(socketId);
    if (targetSocket?.connected) {
      targetSocket.emit("notifyNewStatus", newPostStatus);
    }
  });
};

const shareNewPost = (newPost) => {
  if (!io) {
    socketDebug("share_new_post_skipped_no_io");
    return;
  }
  io.emit("newPostNotification", newPost);
};

module.exports = { setupSocket, notifyOffer, OfferSelected, shareNewPost, notifyNewStatus };
