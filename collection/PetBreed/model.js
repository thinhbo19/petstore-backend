const mongoose = require("mongoose");

var PetBreedSchema = new mongoose.Schema({
  nameBreed: {
    type: String,
    required: true,
    unique: true,
  },
  imgBreed: { type: Array },
  petSpecies: {
    speciesID: {
      type: mongoose.Types.ObjectId,
      ref: "PetSpecies",
      required: true,
    },
    nameSpecies: { type: String },
  },
});

module.exports = mongoose.model("PetBreed", PetBreedSchema);
