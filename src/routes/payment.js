const express = require("express");
const { intent, createStripeAccount, createStripeAccountLink } = require("../controllers/payment");
const router = express.Router();

router.post('/intent', intent)
router.post('/createStripeAccount', createStripeAccount)
router.post('/createStripeAccountLink', createStripeAccountLink)

module.exports = router; 