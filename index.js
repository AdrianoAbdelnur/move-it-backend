const express = require("express");
const mongoose = require('mongoose');
const http = require('http');
const app = express();
require("dotenv").config();
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { setupSocket } = require("./src/socketIo");
const { stripeWebhook } = require("./src/controllers/payment");
const {
  startPaymentReconciliationScheduler,
} = require("./src/services/payments/reconciliation");

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

const createLimiter = ({ windowMs, max, message }) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message },
  });

const globalLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_GLOBAL_MAX || 120),
  message: "Too many requests. Please try again later.",
});

const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_AUTH_MAX || 10),
  message: "Too many authentication attempts. Please try again later.",
});

const resetLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_RESET_MAX || 6),
  message: "Too many verification attempts. Please try again later.",
});

const paymentLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_PAYMENT_MAX || 30),
  message: "Too many payment requests. Please try again later.",
});

app.post(
  "/api/payment/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhook,
);

app.use("/api/userPost/addPost", express.json({ limit: "5mb" }));
app.use("/api/userPost/addPost", express.urlencoded({ extended: true, limit: "5mb" }));
app.use("/api/userPost/addNewOffer", express.json({ limit: "2mb" }));
app.use("/api/userPost/addNewOffer", express.urlencoded({ extended: true, limit: "2mb" }));

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

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

app.use("/api", globalLimiter);
app.use("/api/user/login", authLimiter);
app.use("/api/user/register", authLimiter);
app.use("/api/user/googleLogin", authLimiter);
app.use("/api/user/googleRegister", authLimiter);
app.use("/api/user/appleLogin", authLimiter);
app.use("/api/user/appleRegister", authLimiter);
app.use("/api/user/generateNewValidationCode", resetLimiter);
app.use("/api/user/checkValidationCode", resetLimiter);
app.use("/api/user/updatePass", resetLimiter);
app.use("/api/payment/intent", paymentLimiter);
app.use("/api/payment/release", paymentLimiter);
app.use("/api/payment/createStripeAccount", paymentLimiter);
app.use("/api/payment/createStripeAccountLink", paymentLimiter);

app.use("/api", require("./src/routes"));

const server = http.createServer(app);

setupSocket(server, allowedOrigins);

mongoose.connect(process.env.DB_URL).then(() => {
  console.log("Connected to MongoDB");
  startPaymentReconciliationScheduler();
  server.listen(process.env.API_PORT, () => {
    console.log(`Application listening on port ${process.env.API_PORT}`);
  });
});
