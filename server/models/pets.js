const mongoose = require("mongoose");

var PetSchema = new mongoose.Schema({
  namePet: {
    type: String,
    required: true,
  },
  imgPet: {
    type: Array,
  },
  breed: { type: mongoose.Types.ObjectId, ref: "PetBreed", required: true },
  age: { type: Number },
  gender: { type: String, enum: ["Male", "Female", "Unknown"] },
  description: { type: String },
});
module.exports = mongoose.model("Pets", PetSchema);
