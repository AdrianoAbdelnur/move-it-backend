const express = require("express");
const { addOffer, getOffersForMyPost, deleteOffer, selectOffer, getMyAceptedOffers, modifyStatus } = require("../controllers/offer");
const { decodeToken } = require("../middlewares/auth");
const router = express.Router();

router.post('/addOffer', decodeToken, addOffer)
router.get('/getOffersForMyPost/:id', decodeToken, getOffersForMyPost )
router.patch('/deleteOffer/:id', decodeToken, deleteOffer )
router.patch('/selectOffer/:id', decodeToken, selectOffer )
router.get('/getMyAceptedOffers/:id', decodeToken, getMyAceptedOffers )
router.patch('/modifyStatus', decodeToken, modifyStatus )


module.exports = router; 
