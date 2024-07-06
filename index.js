const express = require("express");
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const app = express();
require("dotenv").config();
const cors = require("cors");

app.use(express.json({ extended: true, limit: "50mb" }));
app.use(express.json());
app.use(cors());

app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, OPTIONS, PUT, PATCH, DELETE"
    );
    res.setHeader(
        "Access-Control-Allow-Headers",
        "X-Requested-With,content-type"
    );
    res.setHeader("Access-Control-Allow-Credentials", true);
    res.setHeader("Access-Control-Max-Age", "86400");
    next();
});

app.use("/api", require("./src/routes"));

const server = http.createServer(app);

const io = socketIo(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'PATCH', 'DELETE']
    }
});

const users = {};

io.on('connection', (socket) => {
    console.log('A user has connected with ID:', socket.id);

    socket.on('newUser', (username) => {
        users[username] = socket.id;
        console.log(`${username} has connected with ID ${socket.id}`);
        console.log(users);
    });

    socket.on('message', (msg) => {
        console.log('Message received:', msg);
        io.emit('message', msg);
    });

    socket.on('privateMessage', ({ message, recipient }) => {
        const recipientSocketId = users[recipient];
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('privateMessage', {
                message,
                sender: socket.id
            });
            console.log(`Private message from ${socket.id} to ${recipientSocketId}: ${message}`);
        } else {
            console.log(`User ${recipient} is not connected`);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        for (let user in users) {
            if (users[user] === socket.id) {
                delete users[user];
                break;
            }
        }
    });
});

mongoose.connect(process.env.DB_URL).then(() => {
    console.log("Connected to MongoDB");
    server.listen(process.env.API_PORT, () => {
        console.log(`Application listening on port ${process.env.API_PORT}`);
    });
});