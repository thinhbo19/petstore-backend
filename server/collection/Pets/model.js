const mongoose = require("mongoose");

var PetSchema = new mongoose.Schema({
  namePet: {
    type: String,
    required: true,
  },
  imgPet: {
    type: Array,
  },
  petBreed: {
    breedID: { type: mongoose.Types.ObjectId, ref: "PetBreed", required: true },
    nameBreed: String,
    nameSpecies: String,
  },
  age: { type: Number },
  gender: { type: String, enum: ["Male", "Female", "Castrated"] },
  description: { type: String },
  price: { type: Number },
  sold: {
    type: Boolean,
    default: false,
  },
});
module.exports = mongoose.model("Pets", PetSchema);
