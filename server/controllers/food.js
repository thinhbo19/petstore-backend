const PetFood = require("../models/food");
const PetSpecies = require("../models/PetSpecies");
const Brand = require("../models/brand");
const { default: mongoose } = require("mongoose");
const asyncHandler = require("express-async-handler");

const createFood = asyncHandler(async (req, res) => {
  try {
    const { nameFood, species, brand, flavor, price, quantity } = req.body;
    if (!mongoose.Types.ObjectId.isValid(species)) {
      return res.status(400).json({ message: "ID invalid!!!!" });
    }
    const existingSpecies = await PetSpecies.findById(species);
    if (!existingSpecies) {
      return res.status(404).json({ message: "Not found species with Id" });
    }
    const newFood = new PetFood({
      nameFood,
      species,
      brand,
      flavor,
      price,
      quantity,
    });
    await newFood.save();
    return res.status(200).json({ success: true, newFood });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = {
  createFood,
};
