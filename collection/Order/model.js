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
      enum: ["PayPal", "VNPay", "MoMo", "PaymentDelivery"],
    },

    coupon: {
      type: mongoose.Types.ObjectId,
      ref: "Voucher",
    },

    address: {
      type: String,
    },
    receiverName: {
      type: String,
      default: "",
    },
    receiverPhone: {
      type: String,
      default: "",
    },

    Note: {
      type: String,
    },

    OrderBy: {
      type: mongoose.Types.ObjectId,
      ref: "User",
    },
    afterSales: {
      requested: { type: Boolean, default: false },
      type: { type: String, enum: ["Return", "Refund", "Complaint", ""], default: "" },
      reason: { type: String, default: "" },
      status: {
        type: String,
        enum: ["Pending", "Approved", "Rejected", ""],
        default: "",
      },
      note: { type: String, default: "" },
      requestedAt: { type: Date, default: null },
      updatedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", OrderSchema);
