const Offer = require("../models/Offer")
const UserPost = require("../models/UserPost")
const { notifyOffer } = require("../socketIo")


const MAX_OFFER_DURATION_MINUTES = 24 * 60;

const normalizeDurationMinutes = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  if (parsed <= 0) return 0;
  return Math.min(Math.floor(parsed), MAX_OFFER_DURATION_MINUTES);
};

const isSameServerDay = (valueA, valueB) => {
  const a = new Date(valueA);
  const b = new Date(valueB);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
};

const computeOfferExpiration = ({ postDate, offerDurationMinutes }) => {
  const now = new Date();
  const normalizedDuration = normalizeDurationMinutes(offerDurationMinutes);

  if (postDate && normalizedDuration > 0 && isSameServerDay(postDate, now)) {
    return new Date(now.getTime() + normalizedDuration * 60 * 1000);
  }

  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  return endOfDay;
};

const expirePendingOffers = async () => {
  await Offer.updateMany(
    {
      isDeleted: false,
      status: "Pending",
      expiredTime: { $lte: new Date() },
    },
    { $set: { status: "expired" } },
  );
};

const addOffer = async(req, res) => {
    try {
        await expirePendingOffers();

        const offer = req.body
        const offerFound = await Offer.findOne({owner: offer.owner, isDeleted: false , post: offer.post, status: { $ne: "expired" }})
        if(!offerFound){
            const post = await UserPost.findById(offer.post).select("date");
            const serverExpiredTime = computeOfferExpiration({
              postDate: post?.date?.date,
              offerDurationMinutes: offer.offerDurationMinutes,
            });

            const {
              expiredTime: _ignoredExpiredTime,
              offerDurationMinutes: _ignoredOfferDuration,
              ...offerPayload
            } = offer;

            let newOffer = new Offer({
              ...offerPayload,
              expiredTime: serverExpiredTime,
            })
            await newOffer.save();
            newOffer = await Offer.findById(newOffer._id).populate('post').populate({
                path: 'owner',
                select: '_id given_name family_name review transportInfo.vehicle transportInfo.stripeAccount expoPushToken'
            });;
            
            const recipient = newOffer.post.owner;
            notifyOffer(recipient, newOffer)

            res.status(200).json({message: 'Offer sent successfully', newOffer})
        }else res.status(409).json({message:'offer already made', offerFound})
    } catch (error) {
        console.error("🔥 Error en addOffer:", error);
        res.status(error.statusCode || 500).json({ message: error.message });
    }
}

const getOffersForMyPost =  async (req, res) => {
    try {
        await expirePendingOffers();
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
        await expirePendingOffers();
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
    modifyStatus,
    expirePendingOffers
}
