const express = require("express");
const mongoose = require('mongoose');
const http = require('http');
const app = express();
require("dotenv").config();
const cors = require("cors");
const { setupSocket } = require("./src/socketIo");
const { stripeWebhook } = require("./src/controllers/payment");

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://callacar.onrender.com",
  "https://tupagina.com",
  "https://cac-web-puce.vercel.app",
  ...(process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map((origin) => origin.trim())
    : []),
];

app.post(
  "/api/payment/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhook,
);

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

setupSocket(server, allowedOrigins);

mongoose.connect(process.env.DB_URL).then(() => {
  console.log("Connected to MongoDB");
  server.listen(process.env.API_PORT, () => {
    console.log(`Application listening on port ${process.env.API_PORT}`);
  });
});
