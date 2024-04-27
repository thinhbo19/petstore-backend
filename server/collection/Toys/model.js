const mongoose = require("mongoose");

var ToySchema = new mongoose.Schema({
  nameToy: {
    type: String,
    required: true,
  },
  brand: {
    brandID: { type: mongoose.Types.ObjectId, ref: "Brand", required: true },
    brandName: String,
  },
  type: {
    type: String,
    required: true,
  },
  material: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
  },
});

module.exports = mongoose.model("Toys", ToySchema);
