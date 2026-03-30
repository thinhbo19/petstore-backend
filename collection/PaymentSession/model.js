const mongoose = require("mongoose");

const paymentSessionSchema = new mongoose.Schema(
  {
    txnRef: { type: String, required: true, unique: true, index: true },
    kind: { type: String, enum: ["order", "booking"], required: true },
    payload: { type: Object, required: true },
    status: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "pending",
    },
    consumedAt: { type: Date, default: null },
    redirectTo: { type: String, default: "" },
  },
  { timestamps: true },
);

paymentSessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });

module.exports = mongoose.model("PaymentSession", paymentSessionSchema);
