const Offer = require("../models/Offer");


const addOffer = async(req, res) => {
    try {
        const newOffer = new Offer(req.body)
        await newOffer.save();
        res.status(200).json({message: 'Offer sent successfully', newOffer})
    } catch (error) {
        res.status(error.code || 500).json({message : error.message})
    }
}

const getMyOffers =  async (req, res) => {
    try {
        const {id} = req.params
        const myOffers = await Offer.find({owner: id});
        res.status(200).json({message: 'Offers found succesfully', myOffers})
    } catch (error) {
        res.status(error.code || 500).json({message : error.message})
    }
}



module.exports = {
    addOffer,
    getMyOffers
}