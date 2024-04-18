const mongoose = require("mongoose");

var ToySchema = new mongoose.Schema({
  nameToy: {
    type: String,
    required: true,
  },
  species: {
    type: mongoose.Types.ObjectId,
    ref: "PetSpecies",
    required: true,
  },
  brand: {
    type: mongoose.Types.ObjectId,
    ref: "Brand",
    required: true,
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
