const {model, Schema, default: mongoose} = require("mongoose")

const ItemDetailsSchema = new Schema({
    description: { type: String },
    itemsList: [
      {
        name: { type: String},
        quantity: { type: Number },
        details: {
          description: String,
          dimensions: {
            length: String,
            width: String,
            height: String,
            weight: String
          }
        }
      }
    ]
  });

const DirectionSchema = new Schema({
    description: { type: String },
    place_id: { type: String},
    location: {
      latitude: { type: Number },
      longitude: { type: Number}
    },
    address_components: [
      {
        long_name: String,
        short_name: String,
        types: [String]
      }
    ]
  });

const UserPostSchema = new Schema({
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    title: { type: String },
    date: {
        date: { type: Date },
        timeDay: { type: String }
      },
    directions: [DirectionSchema],
    itemsDetails: {
        type: Map,
        of: ItemDetailsSchema 
      },
    extraComents: {type: String },
    status: {
            mainStatus: {
                type: String,
                default: "pending"
            },
            newOffers: {
                type: Boolean,
                default: false
            },
            messagesStatus: {
                newUserMessage: {
                    type: Boolean,
                    default: false
                },
                newTransportMessage: {
                    type: Boolean,
                    default: false
                }
            }
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
    chatMessages: [
        {
            sender: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            text: {
                type: String
            },
            date: {
                type:Date, 
                default: Date.now()
            },
        }
    ],
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