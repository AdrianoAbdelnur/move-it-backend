const express = require("express");
const { addOffer, getOffersForMyPost, deleteOffer, selectOffer, getMyAceptedOffers, modifyStatus } = require("../controllers/offer");
const router = express.Router();

router.post('/addOffer', addOffer)
router.get('/getOffersForMyPost/:id', getOffersForMyPost )
router.patch('/deleteOffer/:id', deleteOffer )
router.patch('/selectOffer/:id', selectOffer )
router.get('/getMyAceptedOffers/:id', getMyAceptedOffers )
router.patch('/modifyStatus', modifyStatus )


module.exports = router; 