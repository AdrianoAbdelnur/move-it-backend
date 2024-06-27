const {model, Schema, default: mongoose} = require("mongoose")

const OfferSchema = new Schema({
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    post: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserPost'
    },
    price: {
        type: Number
    },
    offerSelected: {
        type: Boolean,
        default: false
},
    date: {
        type: Date
    },
    createAt: {
        type: Date,
        default: Date.now(),
    },
    isDeleted: {
        type: Boolean,
        default: false,
    },
},{
    versionKey: false
}
)

const Offer = model ('Offer', OfferSchema);

module.exports= Offer;