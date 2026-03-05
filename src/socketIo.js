const socketIo = require("socket.io");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Offer = require("./models/Offer");
const UserPost = require("./models/UserPost");

const users = {};
const lastPong = {};
let io;

const normalizeToken = (tokenValue) =>
  String(tokenValue || "")
    .replace(/^Bearer\s+/i, "")
    .trim();

const getHandshakeToken = (socket) => {
  const authToken = socket?.handshake?.auth?.token;
  if (authToken) return normalizeToken(authToken);
  const queryToken = socket?.handshake?.query?.token;
  if (queryToken) return normalizeToken(queryToken);
  const headerToken = socket?.handshake?.headers?.authorization;
  return normalizeToken(headerToken);
};

const isAllowedOrigin = (origin, allowedOrigins) =>
  !origin || allowedOrigins.includes(origin);

const getRecipientSockets = (recipient) => users[String(recipient)] || [];

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
  io = socketIo(server, {
    cors: {
      origin: (origin, callback) => {
        if (isAllowedOrigin(origin, allowedOrigins)) return callback(null, true);
        return callback(new Error("Not allowed by CORS"));
      },
      methods: ["GET", "POST", "OPTIONS", "PUT", "PATCH", "DELETE"],
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      const token = getHandshakeToken(socket);
      if (!token) return next(new Error("Unauthorized"));
      const { user } = jwt.verify(token, process.env.SECRET_WORD);
      if (!user?.id) return next(new Error("Unauthorized"));
      socket.userId = String(user.id);
      socket.userRole = user.role;
      return next();
    } catch (error) {
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const userId = String(socket.userId);
    if (!users[userId]) users[userId] = [];
    users[userId].push(socket.id);
    lastPong[socket.id] = Date.now();
    console.log(`Authenticated socket connected: ${socket.id} as ${userId}`);

    socket.on("newUser", (claimedUserId) => {
      if (claimedUserId && String(claimedUserId) !== userId) {
        console.warn(
          `Socket ${socket.id} attempted to claim ${claimedUserId} but is authenticated as ${userId}`,
        );
      }
    });

    socket.on("pongCheck", () => {
      lastPong[socket.id] = Date.now();
    });

    socket.on("privateMessage", async ({ text, recipient, postId }, callback) => {
      const senderId = String(socket.userId);
      const recipientId = normalizeId(recipient);
      const normalizedPostId = normalizeId(postId);

      if (!text || !recipientId || !normalizedPostId) {
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

        callback?.(
          sent
            ? { status: "ok" }
            : { status: "error", reason: "recipient_not_connected" },
        );
      } catch (error) {
        callback?.({ status: "error", reason: "server_error" });
      }
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);
      if (users[userId]) {
        users[userId] = users[userId].filter((id) => id !== socket.id);
        if (users[userId].length === 0) delete users[userId];
      }
      delete lastPong[socket.id];
    });
  });

  setInterval(() => {
    const timeout = 60000;
    for (const [socketId, lastTime] of Object.entries(lastPong)) {
      const now = Date.now();
      if (now - lastTime > timeout) {
        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
          console.log("Disconnecting inactive socket:", socketId);
          socket.disconnect(true);
        }
      } else {
        io.to(socketId).emit("pingCheck");
      }
    }
  }, 45000);
};

const notifyOffer = (recipient, newOffer) => {
  const sockets = getRecipientSockets(recipient);
  sockets.forEach((socketId) => {
    const targetSocket = io.sockets.sockets.get(socketId);
    if (targetSocket?.connected) {
      targetSocket.emit("offerNotification", newOffer);
    }
  });
};

const OfferSelected = (recipient, postOfferSelected) => {
  const sockets = getRecipientSockets(recipient);
  sockets.forEach((socketId) => {
    const targetSocket = io.sockets.sockets.get(socketId);
    if (targetSocket?.connected) {
      targetSocket.emit("OfferSelected", postOfferSelected);
    }
  });
};

const notifyNewStatus = (recipient, newPostStatus) => {
  const sockets = getRecipientSockets(recipient);
  sockets.forEach((socketId) => {
    const targetSocket = io.sockets.sockets.get(socketId);
    if (targetSocket?.connected) {
      targetSocket.emit("notifyNewStatus", newPostStatus);
    }
  });
};

const shareNewPost = (newPost) => {
  io.emit("newPostNotification", newPost);
};

module.exports = { setupSocket, notifyOffer, OfferSelected, shareNewPost, notifyNewStatus };
