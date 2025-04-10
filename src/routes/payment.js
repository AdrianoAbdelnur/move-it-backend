const express = require("express");
const { intent, createStripeAccount, createStripeAccountLink, returnUrl, refreshUrl, deleteUser, deleteStripeUser, checkStripeAccountStatus } = require("../controllers/payment");
const router = express.Router();

router.post('/intent', intent)
router.post('/createStripeAccount', createStripeAccount)
router.post('/createStripeAccountLink', createStripeAccountLink)
router.get('/returnUrl', returnUrl)
router.get('/refreshUrl', refreshUrl)
router.post('/deleteStripeUser', deleteStripeUser)
router.get('/checkStripeAccountStatus/:id', checkStripeAccountStatus)

module.exports = router; 