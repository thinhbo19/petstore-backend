const PetFood = require("./model");
const PetSpecies = require("../PetSpecies/model");
const Brand = require("../Brand/model");
const { default: mongoose } = require("mongoose");
const asyncHandler = require("express-async-handler");

const createFood = asyncHandler(async (req, res) => {
  try {
    const { nameFood, speciesID, brandID, flavor, price, quantity } = req.body;
    if (!mongoose.Types.ObjectId.isValid(speciesID)) {
      return res.status(400).json({ message: "ID Species invalid!!!!" });
    }
    if (!mongoose.Types.ObjectId.isValid(brandID)) {
      return res.status(400).json({ message: "ID Brand invalid!!!!" });
    }
    const existingSpecies = await PetSpecies.findById(speciesID);
    if (!existingSpecies) {
      return res.status(404).json({ message: "Not found species with Id" });
    }
    const existingBrand = await Brand.findById(brandID);
    if (!existingBrand) {
      return res.status(404).json({ message: "Not found brand with Id" });
    }
    const newFood = new PetFood({
      nameFood,
      petSpecies: { speciesID, nameSpecies: existingSpecies.nameSpecies },
      brand: { brandID, brandName: existingBrand.nameBrand },
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
