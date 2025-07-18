const {model, Schema, default: mongoose} = require("mongoose");

const UserSchema = new Schema({
    given_name: {
        type: String
    },
    family_name: {
        type: String
    },
    email: {
        type: String,
        trim: true
    },
    password: {
        type: String
    },
    createAt: {
        type: Date,
        default: Date.now(),
    },
    validatedMail: {
        type: Boolean,
        default: false,
    },
    verificationInfo: {
        verificationCode: { 
            type: String
        },
        expirationTime: {
            type: Date
        },
        attempts: { 
            type: Number, 
            default: 0 
        }, 
        blockTime: { 
            type: Date, 
            default: null 
        }, 
        isPermanentlyBlocked: { 
            type: Boolean, 
            default: false 
        }
    },
    isDeleted: {
        type: Boolean,
        default: false,
    },
    role: {
        type: String,
        default: 'user'
    },
    expoPushToken: {
        type: String
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
    accountSuspended: [{
        suspendedDate: {
            type:Date,
            default: Date.now(),
        },
        reason: {
            type: String
        },
        suspensionEndDate: {
            type: Date
        }
    }],
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
        },
        stripeAccount: {
            accountId: {
                type: String
            },
            validatedAccount: {
                type: Boolean,
                default: false
            }
        }
    }
},{
    versionKey: false
}
)

const User = model ('User', UserSchema);

module.exports= User;