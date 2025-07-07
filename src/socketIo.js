const socketIo = require("socket.io");

const users = {};
const lastPong = {};
let io; 

const setupSocket = (server) => {
    io = socketIo(server, { 
        cors: {
            origin: '*',
            methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'PATCH', 'DELETE']
        }
    });

    io.on("connection", (socket) => {
        console.log("New client connected:", socket.id);

        socket.on("newUser", (username) => {
            if (!users[username]) users[username] = [];
            users[username].push(socket.id);
            socket.userName = username;
            lastPong[socket.id] = Date.now();
            console.log(`${username} conectado con ID ${socket.id}`);
          });
      
          socket.on("pongCheck", () => {
            lastPong[socket.id] = Date.now();
          });

          socket.on("privateMessage", ({ text, recipient, postId }, callback) => {
            const sockets = users[recipient] || [];
            let sent = false;
      
            sockets.forEach(socketId => {
              const targetSocket = io.sockets.sockets.get(socketId);
              if (targetSocket?.connected) {
                targetSocket.emit("privateMessage", {
                  text,
                  sender: socket.userName,
                  postId
                });
                sent = true;
              }
            });
      
            callback?.(sent ? { status: "ok" } : { status: "error", reason: "Usuario no conectado" });
          });

          socket.on("disconnect", () => {
            console.log("Usuario desconectado:", socket.id);
            const username = socket.userName;
            if (username && users[username]) {
              users[username] = users[username].filter(id => id !== socket.id);
              if (users[username].length === 0) delete users[username];
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
                console.log("💀 Desconectando socket inactivo:", socketId);
                socket.disconnect(true);
              }
            } else {
              io.to(socketId).emit("pingCheck");
            }
          }
        }, 30000); 
      };


      const notifyOffer = (recipient, newOffer) => {
        const sockets = users[recipient] || [];
        sockets.forEach(socketId => {
          const targetSocket = io.sockets.sockets.get(socketId);
          if (targetSocket?.connected) {
            targetSocket.emit("offerNotification", newOffer);
          }
        });
      };
      
      const OfferSelected = (recipient, postOfferSelected) => {
        const sockets = users[recipient] || [];
        sockets.forEach(socketId => {
          const targetSocket = io.sockets.sockets.get(socketId);
          if (targetSocket?.connected) {
            targetSocket.emit("OfferSelected", postOfferSelected);
          }
        });
      };
      
      const notifyNewStatus = (recipient, newPostStatus) => {
        const sockets = users[recipient] || [];
        sockets.forEach(socketId => {
          const targetSocket = io.sockets.sockets.get(socketId);
          if (targetSocket?.connected) {
            targetSocket.emit("notifyNewStatus", newPostStatus);
          }
        });
      };


    const shareNewPost = (newPost) => {
        io.emit("newPostNotification", newPost);
    }



module.exports = { setupSocket, notifyOffer,OfferSelected, shareNewPost, notifyNewStatus };