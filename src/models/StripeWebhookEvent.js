const { model, Schema } = require("mongoose");

const StripeWebhookEventSchema = new Schema(
  {
    stripeEventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
    },
    offer: {
      type: Schema.Types.ObjectId,
      ref: "Offer",
    },
    status: {
      type: String,
      enum: ["processing", "processed", "failed"],
      default: "processing",
    },
    error: {
      type: String,
    },
    processedAt: {
      type: Date,
    },
  },
  { versionKey: false, timestamps: true },
);

module.exports = model("StripeWebhookEvent", StripeWebhookEventSchema);
