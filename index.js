const express = require("express");
const mongoose = require('mongoose');
const http = require('http');
const app = express();
require("dotenv").config();
const cors = require("cors");
const { setupSocket } = require("./src/socketIo");


const allowedOrigins = [
  "http://localhost:5173",           
  "https://tupagina.com",            
];

app.use(express.json({ extended: true, limit: "50mb" }));
app.use(express.json());

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));

app.use("/api", require("./src/routes"));

const server = http.createServer(app);

setupSocket(server);

mongoose.connect(process.env.DB_URL).then(() => {
  console.log("Connected to MongoDB");
  server.listen(process.env.API_PORT, () => {
    console.log(`Application listening on port ${process.env.API_PORT}`);
  });
});