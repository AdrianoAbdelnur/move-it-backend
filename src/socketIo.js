const socketIo = require("socket.io");

const users = {};
let io; 

const setupSocket = (server) => {
    io = socketIo(server, { 
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
};

const notifyOffer = (recipient, newOffer) => {
    const recipientSocketId = users[recipient];
    if (recipientSocketId) {
        io.to(recipientSocketId).emit("offerNotification", newOffer);
    }
};

const OfferSelected = (recipient, postOfferSelected) => {
    const recipientSocketId = users[recipient];
    console.log("recipient", recipient, "newOffer", postOfferSelected, "recipientSocketId", recipientSocketId);
    if (recipientSocketId) {
        io.to(recipientSocketId).emit("OfferSelected", postOfferSelected);
    }
};

const shareNewPost = (newPost) => {
    io.emit("newPostNotification", newPost);
}

const notifyNewStatus = (recipient, newPostStatus)=> {
    const recipientSocketId = users[recipient];
    if (recipientSocketId) {
        io.to(recipientSocketId).emit("notifyNewStatus", newPostStatus);
    }
}

module.exports = { setupSocket, notifyOffer,OfferSelected, shareNewPost, notifyNewStatus };