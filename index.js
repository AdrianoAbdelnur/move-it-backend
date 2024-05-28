const express = require("express");
const mongoose = require('mongoose')
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

// Integrar Socket.IO con el servidor HTTP
const io = socketIo(server, {
    cors: {
        cors: {
            origin: '*',
            methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'PATCH', 'DELETE']
        }
    }
});

const usuarios = {};

io.on('connection', (socket) => {
    console.log('Un usuario se ha conectado con ID:', socket.id);

    socket.on('nuevoUsuario',(nombreUsuario)=> {
        usuarios[nombreUsuario] = socket.id;
        console.log(`${nombreUsuario} se ha conectado con ID ${socket.id}`);
        console.log(usuarios)
    } )

    // Ejemplo de evento de mensaje
    socket.on('mensaje', (msg) => {
        console.log('Mensaje recibido:', msg);
        io.emit('mensaje', msg); // Reenvía el mensaje a todos los clientes
    });

    // Manejo de desconexión
    socket.on('disconnect', () => {
        console.log('Usuario desconectado:', socket.id);
    });
});

mongoose.connect(process.env.DB_URL).then(() => {
    console.log("conectado a mongodb");
    server.listen(process.env.API_PORT, () => {
        console.log(`aplicacion escuchando en puerto ${process.env.API_PORT}`);
    });
});