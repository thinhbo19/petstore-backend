const mongoose = require("mongoose");

var FoodSchema = new mongoose.Schema({
  nameFood: {
    type: String,
    required: true,
  },
  species: {
    type: mongoose.Types.ObjectId,
    ref: "PetSpecies",
    required: true,
  },
  brand: {
    type: String,
    required: true,
    unique: true,
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
