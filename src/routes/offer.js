const express = require("express");
const { addOffer, getMyOffers } = require("../controllers/offer");
const router = express.Router();

router.post('/addOffer', addOffer)
router.get('/myOffers/:id', getMyOffers )

module.exports = router; 