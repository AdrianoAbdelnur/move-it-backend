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
    expiredTime: {
        type: Date
    },
    offerDetails: {
        type: String
    },
    createAt: {
        type: Date,
        default: Date.now(),
    },
    isDeleted: {
        type: Boolean,
        default: false,
    },
    status: {
        type: String,
        default: "Pending"
    },
    payment: {
        paymentIntentId: { 
                type: String 
            },
        providerStripeAccountId: { 
                type: String 
            },
        amount: { 
                type: Number 
            },
        released: { 
                type: Boolean, 
                default: false 
            },
        transferId: { 
                type: String 
            }
  }

},{
    versionKey: false
}
)

const Offer = model ('Offer', OfferSchema);

module.exports= Offer;