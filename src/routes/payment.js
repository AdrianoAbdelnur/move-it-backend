const express = require("express");
const { intent } = require("../controllers/payment");
const router = express.Router();

router.post('/intent', intent)

module.exports = router; 