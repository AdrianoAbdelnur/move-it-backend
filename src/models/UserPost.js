const {model, Schema, default: mongoose} = require("mongoose")

const UserPostSchema = new Schema({
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    goodsType: {
        type: String
    },
    dimensions: {

        length: {
            type: Number
        },
        width: {
            type: Number
        },
        height: {
            type: Number
        },
        weight: {
            type: Number
        },
    },
    directions: { 
        from: {type: String }, 
        to: {type: String } 
    },
    date: { 
        date: {type: String }, 
        time: {type: String } 
    },
    extraComents: {type: String },
    status: {
        type: String,
        default: "Pending"
    }
},{
    versionKey: false
}
)

const UserPost = model ('UserPost', UserPostSchema);

module.exports= UserPost;