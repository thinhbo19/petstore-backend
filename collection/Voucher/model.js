const mongoose = require("mongoose"); // Erase if already required

// Declare the Schema of the Mongo model
var voucherSchema = new mongoose.Schema({
  nameVoucher: {
    type: String,
    required: true,
    uppercase: true,
  },
  typeVoucher: {
    type: String,
    required: true,
    enum: ["Pet", "Accessory", "Booking", "Ship"],
  },
  discount: {
    type: Number,
    required: true,
  },
  exclusive: {
    type: Number,
    required: true,
  },
  expiry: {
    type: Date,
    required: true,
  },
  status: {
    type: Boolean,
    default: false,
  },
});

//Export the model
module.exports = mongoose.model("Voucher", voucherSchema);
