
const socketIo = require("socket.io");

const users = {};

const setupSocket = (server) => {
    const io = socketIo(server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'PATCH', 'DELETE']
        }
    });

    io.on("connection", (socket) => {
        console.log("Nuevo cliente conectado:", socket.id);

        socket.on("newUser", (username) => {
            users[username] = socket.id;
            socket.userName = username;
            console.log(`${username} conectado con ID ${socket.id}`);
        });

        socket.on("message", (msg) => {
            console.log("Mensaje recibido:", msg);
            io.emit("message", msg);
        });

        socket.on("privateMessage", ({ text, recipient, postId }) => {
            const recipientSocketId = users[recipient];
            if (recipientSocketId) {
                io.to(recipientSocketId).emit("privateMessage", {
                    text,
                    sender: socket.userName,
                    postId
                });
            } else {
                console.log(`El usuario ${recipient} no está conectado`);
            }
        });

        socket.on("disconnect", () => {
            console.log("Usuario desconectado:", socket.id);
            if (socket.userName) delete users[socket.userName];
        });
    });

    return { io, users };   
}

module.exports = setupSocket;
