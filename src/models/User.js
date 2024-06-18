const {model, Schema} = require("mongoose");

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
    transportInfo: {
        vehicle: {
            type: String    
        },
        registrationPlate: {
            type: String
        },
        licenseImage: {
            type: String
        }
    }
},{
    versionKey: false
}
)

const User = model ('User', UserSchema);

module.exports= User;