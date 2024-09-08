const mongoose = require("mongoose"); // Erase if already required

// Declare the Schema of the Mongo model
var voucherSchema = new mongoose.Schema({
  nameVoucher: {
    type: String,
    required: true,
    uppercase: true,
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
});

//Export the model
module.exports = mongoose.model("Voucher", voucherSchema);
