const { default: mongoose } = require("mongoose");
const PetBreed = require("../models/petBreed");
const asyncHandler = require("express-async-handler");
const PetSpecies = require("../models/PetSpecies");

const createNewBreed = asyncHandler(async (req, res) => {
  try {
    const { nameBreed, species } = req.body;
    if (!mongoose.Types.ObjectId.isValid(species)) {
      return res.status(400).json({ message: "ID invalid!!!!" });
    }
    const existingSpecies = await PetSpecies.findById(species);
    if (!existingSpecies) {
      return res.status(404).json({ message: "Not found species with Id" });
    }
    const newPetBreed = new PetBreed({ nameBreed, species });
    await newPetBreed.save();
    return res.status(200).json({ success: true, newPetBreed });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
const getAllPetBreed = asyncHandler(async (req, res) => {
  try {
    const petBreed = await PetBreed.find();
    return res.status(200).json({
      success: true,
      petBreed,
    });
  } catch (error) {
    throw new Error(error);
  }
});
const changePetBreed = asyncHandler(async (req, res) => {
  try {
    const { bid } = req.params;
    const { nameBreed } = req.body;
    const updateNameBreed = await PetBreed.findByIdAndUpdate(
      bid,
      { nameBreed },
      { new: true }
    );
    if (!updateNameBreed) {
      return res
        .status(404)
        .json({ success: false, message: "Can not find pet breed!!!" });
    }
    return res.status(200).json({
      success: true,
      message: updateNameBreed,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Error update.",
    });
  }
});
const deletePetBreed = asyncHandler(async (req, res) => {
  try {
    const { bid } = req.params;
    if (!bid) throw new Error("Missing Id!!");
    const petBreed = await PetBreed.findByIdAndDelete(bid);
    return res.status(200).json({
      success: petBreed ? true : false,
      DeletePetBreed: petBreed ? `Sucessfully` : "No pet breed is deleted",
    });
  } catch (error) {
    throw new Error(error);
  }
});
module.exports = {
  createNewBreed,
  getAllPetBreed,
  changePetBreed,
  deletePetBreed,
};
