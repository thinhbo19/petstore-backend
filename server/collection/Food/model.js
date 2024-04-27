const mongoose = require("mongoose");

var FoodSchema = new mongoose.Schema({
  nameFood: {
    type: String,
    required: true,
  },
  petSpecies: {
    speciesID: {
      type: mongoose.Types.ObjectId,
      ref: "PetSpecies",
      required: true,
    },
    nameSpecies: String,
  },
  brand: {
    brandID: { type: mongoose.Types.ObjectId, ref: "Brand", required: true },
    brandName: String,
  },
  flavor: {
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

module.exports = mongoose.model("Food", FoodSchema);
