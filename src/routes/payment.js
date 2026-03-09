const express = require("express");
const { intent, createStripeAccount, createStripeAccountLink, returnUrl, refreshUrl, deleteUser, deleteStripeUser, checkStripeAccountStatus, release } = require("../controllers/payment");
const { decodeToken, adminRequiredValidation } = require("../middlewares/auth");
const router = express.Router();

router.post('/intent', decodeToken, intent)
router.post('/createStripeAccount', decodeToken, createStripeAccount)
router.post('/createStripeAccountLink', decodeToken, createStripeAccountLink)
router.get('/returnUrl', returnUrl)
router.get('/refreshUrl', refreshUrl)
router.post('/deleteStripeUser', decodeToken, adminRequiredValidation, deleteStripeUser)
router.get('/checkStripeAccountStatus/:id', decodeToken, checkStripeAccountStatus)
router.post('/release', decodeToken, release);

module.exports = router; 
