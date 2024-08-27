const {model, Schema, default: mongoose} = require("mongoose");

const UserSchema = new Schema({
    given_name: {
        type: String
    },
    family_name: {
        type: String
    },
    email: {
        type: String
    },
    password: {
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
    role: {
        type: String,
        default: 'user'
    },
    infoCompletedFlag: {
        type: Boolean,
        default: false
    },
    authorizedTransport: {
        type: Boolean,
        default: false
    },
    cancelledServices: [
        {
            serviceId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'UserPost'
            },
            cancelledDate: {
                type: Date,
            },
            refunded: {
                type: Boolean,
                default: null
            }
        }
    ],
    review: {
        reviewsQuantity: {
            type: Number,
            default: 0
        },
        review: [
            {
            type: String
            }
        ],
        punctualityRating: {
            type: Number
        },
        comunicationRating: {
            type: Number
        },
        generalServiceRating: {
            type: Number
        }
    },
    transportInfo: {
        vehicle: {
            type: String    
        }, 
        registrationPlate: {
            type: String
        },
        cargoAreaImg: {
            type: String    
        },
        generalImg: {
            type: String    
        },
        licenseFrontImg: {
            type: String
        },
        licenseBackImg: {
            type: String
        },
        profilePhotoImg: {
            type: String
        },
        policeCheckPdf: {
            type: String
        }
    }
},{
    versionKey: false
}
)

const User = model ('User', UserSchema);

module.exports= User;