const mongoose = require("mongoose");

var petSpeciesSchema = new mongoose.Schema({
  nameSpecies: {
    type: String,
    required: true,
  },
});

module.exports = mongoose.model("PetSpecies", petSpeciesSchema);
