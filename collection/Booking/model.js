const mongoose = require("mongoose");

var bookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Types.ObjectId,
      ref: "User",
      require: true,
    },
    pet: {
      name: { type: String, required: true },
      images: { type: Array },
      breed: { type: String },
      age: { type: Number },
      gender: { type: String, enum: ["Male", "Female"] },
      deworming: { type: Number },
      vaccination: { type: Number },
    },
    services: [
      {
        type: mongoose.Schema.ObjectId,
        ref: "TypeService",
        require: true,
      },
    ],
    voucher: {
      type: mongoose.Schema.ObjectId,
      ref: "Voucher",
      require: true,
    },

    Note: { type: String },
    bookingDate: { type: Date },
    realDate: { type: Date, default: Date.now },
    totalPrice: { type: Number, required: true },
    paymentMethod: {
      type: String,
      enum: ["PayPal", "VNPay", "PaymentDelivery"],
    },
    status: {
      type: String,
      enum: ["Processing", "Confirmed", "Completed", "Cancelled"],
      default: "Processing",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Booking", bookingSchema);
