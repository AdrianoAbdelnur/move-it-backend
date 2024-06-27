const express = require("express");
const { addOffer, getOffersForMyPost, deleteOffer } = require("../controllers/offer");
const router = express.Router();

router.post('/addOffer', addOffer)
router.get('/getOffersForMyPost/:id', getOffersForMyPost )
router.patch('/deleteOffer/:id', deleteOffer )


module.exports = router; 