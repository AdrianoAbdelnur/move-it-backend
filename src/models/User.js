const {model, Schema} = require("mongoose");

const UserSchema = new Schema({
    name: {
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
},{
    versionKey: false
}
)

const User = model ('User', UserSchema);

module.exports= User;