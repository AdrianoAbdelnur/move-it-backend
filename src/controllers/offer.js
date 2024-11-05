const Offer = require("../models/Offer")
const { notifyOffer } = require("../socketIo")


const addOffer = async(req, res) => {
    try {
        const offer = req.body
        const offerFound = await Offer.findOne({owner: offer.owner, isDeleted: false , post: offer.post, status: { $ne: "expired" }})
        if(!offerFound){
            let newOffer = new Offer(req.body)
            await newOffer.save();
            newOffer = await Offer.findById(newOffer._id).populate('post').populate({
                path: 'owner',
                select: '_id given_name family_name review transportInfo.vehicle expoPushToken'
            });;
            
            const recipient = newOffer.post.owner;
            notifyOffer(recipient, newOffer)


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
            select: '_id given_name family_name review transportInfo.vehicle'
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
        const { id } = req.params
        if (id) {
    
            const offersFound = await Offer.find({ owner: id, status: "offerSelected" }).populate({
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
        }
    } catch (error) {
        res.status(error.code || 500).json({ message: error.message })
    }
};

const modifyStatus = async (req, res) => {
    try {
        const { offerId, newStatus } = req.body;

        if (Array.isArray(offerId)) {
            await Offer.updateMany(
                { _id: { $in: offerId } },
                { $set: { status: newStatus } }
            );
            return res.status(200).json({ message: 'The offers status have been updated'});
        } else {
            const updatedOffers = await Offer.findByIdAndUpdate(
                offerId,
                { $set: { status: newStatus } },
                { new: true }
            ).populate({
                path: 'owner',
                select: '_id given_name family_name review transportInfo.vehicle expoPushToken'
            });
            return res.status(200).json({ message: 'The offer status has been updated',  updatedOffers});
        }
    } catch (error) {
        res.status(error.code || 500).json({ message: error.message });
    }
};



module.exports = {
    addOffer,
    getOffersForMyPost,
    deleteOffer,
    selectOffer,
    getMyAceptedOffers,
    modifyStatus
}