const PetToys = require("../models/toys");
const PetSpecies = require("../models/PetSpecies");
const { default: mongoose } = require("mongoose");
const asyncHandler = require("express-async-handler");

const createToys = asyncHandler(async (req, res) => {
  try {
    const { nameToy, species, type, material, price, quantity } = req.body;
    if (!mongoose.Types.ObjectId.isValid(species)) {
      return res.status(400).json({ message: "ID invalid!!!!" });
    }
    const existingSpecies = await PetSpecies.findById(species);
    if (!existingSpecies) {
      return res.status(404).json({ message: "Not found species with Id" });
    }
    const newToys = new PetToys({
      nameToy,
      species,
      type,
      material,
      price,
      quantity,
    });
    await newToys.save();
    return res.status(200).json({ success: true, newToys });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = {
  createToys,
};
