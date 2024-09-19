const mongoose = require("mongoose");

var OrderSchema = new mongoose.Schema(
  {
    products: [
      {
        product: {
          type: mongoose.Types.ObjectId,
          ref: "Product",
        },
        count: { type: Number },
        price: { type: Number },
        img: { type: String },
        name: { type: String },
      },
    ],
    pets: [
      {
        pet: {
          type: mongoose.Types.ObjectId,
          ref: "Pets",
        },
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
