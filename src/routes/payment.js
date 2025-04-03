const express = require("express");
const { intent, createStripeAccount, createStripeAccountLink, returnUrl, refreshUrl } = require("../controllers/payment");
const router = express.Router();

router.post('/intent', intent)
router.post('/createStripeAccount', createStripeAccount)
router.post('/createStripeAccountLink', createStripeAccountLink)
router.post('/returnUrl', returnUrl)
router.post('/refreshUrl', refreshUrl)

module.exports = router; 