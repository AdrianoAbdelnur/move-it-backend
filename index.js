const express = require("express");
const mongoose = require('mongoose');
const http = require('http');
const app = express();
require("dotenv").config();
const cors = require("cors");
const {setupSocket} = require("./src/socketIo")

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

setupSocket(server);

mongoose.connect(process.env.DB_URL).then(() => {
    console.log("Connected to MongoDB");
    server.listen(process.env.API_PORT, () => {
        console.log(`Application listening on port ${process.env.API_PORT}`);
    });
});
