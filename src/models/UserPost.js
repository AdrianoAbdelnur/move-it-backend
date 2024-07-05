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
        from: {
            description: {type: String },
            place_id: {type: String},
            location: {
                latitude: { type: Number },
                longitude: { type: Number }
            },
            address_components: [
                {
                    long_name: { type: String },
                    short_name: { type: String },
                    types: [{ type: String }]
                }
            ]
        }, 
        to: {
            description: {type: String },
            place_id: {type: String},
            location: {
                latitude: { type: Number },
                longitude: { type: Number }
            },
            address_components: [
                {
                    long_name: { type: String },
                    short_name: { type: String },
                    types: [{ type: String }]
                }
            ]
        } 
    },
    date: { 
       type: Date
    }
    ,
    extraComents: {type: String },
    status: {
        type: String,
        default: "Pending"
    },
    offers: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Offer'
        },
    ],
    offerSelected: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Offer'
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

const UserPost = model ('UserPost', UserPostSchema);

module.exports= UserPost;