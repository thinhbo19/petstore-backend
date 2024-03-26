const mongoose = require("mongoose");

var PetSchema = new mongoose.Schema({
  namePet: {
    type: String,
    required: true,
  },
  species: { type: Schema.Types.ObjectId, ref: "PetSpecies", required: true },
  age: { type: Number },
  gender: { type: String, enum: ["Male", "Female", "Unknown"] },
  description: { type: String },
});
module.exports = mongoose.model("Pets", PetSchema);
