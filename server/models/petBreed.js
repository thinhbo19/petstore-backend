const mongoose = require("mongoose");

var userSchema = new mongoose.Schema({
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

module.exports = mongoose.model("PetBreed", userSchema);
