const mongoose = require("mongoose");

var PetBreedSchema = new mongoose.Schema({
  nameBreed: {
    type: String,
    required: true,
    unique: true,
  },
  species: {
    type: mongoose.Types.ObjectId,
    ref: "PetSpecies",
    required: true,
  },
});

module.exports = mongoose.model("PetBreed", PetBreedSchema);
