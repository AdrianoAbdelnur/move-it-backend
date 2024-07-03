const Offer = require("../models/Offer");


const addOffer = async(req, res) => {
    try {
        const offer = req.body
        offerFound = await Offer.findOne({owner: offer.owner, isDeleted: false , post: offer.post})
        if(!offerFound){
            let newOffer = new Offer(req.body)
            await newOffer.save();
            newOffer = await Offer.findById(newOffer._id).populate('post');
            res.status(200).json({message: 'Offer sent successfully', newOffer})
        }else res.status(409).json({message:'offer already made', offerFound})
    } catch (error) {
        res.status(error.code || 500).json({message : error.message})
    }
}

const getOffersForMyPost =  async (req, res) => {
    try {
        const {id} = req.params
        const myOffers = await Offer.find({post: id}).populate({
            path: 'owner',
            select: '_id given_name family_name review'
          })
        res.status(200).json({message: 'Offers found succesfully', myOffers})
    } catch (error) {
        res.status(error.code || 500).json({message : error.message})
    }
}

 const deleteOffer = async (req, res) => {
    try {
        const { id } = req.params;
        const offerToDelete = await Offer.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
        if (!offerToDelete) return res.status(400).json({ message: 'offer no found' });
        res.status(200).json({ message: 'Offer deleted successfully.', offerToDelete });
    } catch (error) {
        res.status(error.code || 500).json({ message: error.message })
    }
};

const selectOffer = async (req, res) => {
    try {
        const { id } = req.params;
        const offerFound = await Offer.findByIdAndUpdate(id, {status: "offerSelected"}, {new:true})
        if (offerFound) {
            res.status(200).json({ message: 'Offer selected.', offerFound });
        }
    } catch (error) {
        res.status(error.code || 500).json({ message: error.message })
    }
};

const getMyAceptedOffers = async (req, res) => {
    try {
        const { ownerId } = req.body
        const offersFound = await Offer.find({ owner: ownerId, status: "offerSelected" }).populate({
            path: 'post',
            populate: {
                path: 'owner',
                model: 'User',
                select: 'given_name family_name review'
            }
        })
        if (offersFound) {
            res.status(200).json({ message: 'Your accepted offers were successfully retrieved.', offersFound });
        }
    } catch (error) {
        res.status(error.code || 500).json({ message: error.message })
    }
};


module.exports = {
    addOffer,
    getOffersForMyPost,
    deleteOffer,
    selectOffer,
    getMyAceptedOffers
}