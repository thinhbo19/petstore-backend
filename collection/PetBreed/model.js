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
PetBreedSchema.index({ "petSpecies.nameSpecies": 1 });
PetBreedSchema.index({ "petSpecies.speciesID": 1 });

module.exports = mongoose.model("PetBreed", PetBreedSchema);
