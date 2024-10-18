const mongoose = require("mongoose");

var OrderSchema = new mongoose.Schema(
  {
    products: [
      {
        id: { type: mongoose.Types.ObjectId },
        count: { type: Number },
        price: { type: Number },
        img: { type: String },
        name: { type: String },
      },
    ],
    totalPrice: {
      type: Number,
    },
    status: {
      type: String,
      default: "Processing",
      enum: ["Cancelled", "Processing", "Shipping", "Success"],
    },

    paymentMethod: {
      type: String,
      enum: ["PayPal", "VNPay", "PaymentDelivery"],
    },

    coupon: {
      type: mongoose.Types.ObjectId,
      ref: "Voucher",
    },

    address: {
      type: String,
    },

    Note: {
      type: String,
    },

    OrderBy: {
      type: mongoose.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", OrderSchema);
