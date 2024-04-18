const PetToys = require("../models/toys");
const PetSpecies = require("../models/PetSpecies");
const { default: mongoose } = require("mongoose");
const asyncHandler = require("express-async-handler");

const createToys = asyncHandler(async (req, res) => {
  try {
    const { nameToy, species, brand, type, material, price, quantity } =
      req.body;
    if (!mongoose.Types.ObjectId.isValid(species)) {
      return res.status(400).json({ message: "ID invalid!!!!" });
    }
    if (!mongoose.Types.ObjectId.isValid(brand)) {
      return res.status(400).json({ message: "ID Brand invalid!!!!" });
    }
    const existingSpecies = await PetSpecies.findById(species);
    if (!existingSpecies) {
      return res.status(404).json({ message: "Not found species with Id" });
    }
    const existingBrand = await PetSpecies.findById(brand);
    if (!existingBrand) {
      return res.status(404).json({ message: "Not found brand with Id" });
    }
    const newToys = new PetToys({
      nameToy,
      species,
      brand,
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
