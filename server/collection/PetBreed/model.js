const mongoose = require("mongoose");

var PetBreedSchema = new mongoose.Schema({
  nameBreed: {
    type: String,
    required: true,
    unique: true,
  },
  petSpecies: {
    speciesID: {
      type: mongoose.Types.ObjectId,
      ref: "PetSpecies",
      required: true,
    },
    nameSpecies: String,
  },
});

module.exports = mongoose.model("PetBreed", PetBreedSchema);
