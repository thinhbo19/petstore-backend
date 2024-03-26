const { default: mongoose } = require("mongoose");
const asyncHandler = require("express-async-handler");
const Pets = require("../models/pets");
const PetBreed = require("../models/petBreed");

const createNewPets = asyncHandler(async (req, res) => {
  try {
    const { namePet, breed, age, gender, description } = req.body;
    if (!mongoose.Types.ObjectId.isValid(breed)) {
      return res.status(400).json({ message: "ID invalid!!!!" });
    }
    const existingBreed = await PetBreed.findById(breed);
    if (!existingBreed) {
      return res.status(404).json({ message: "Not found breed with Id" });
    }
    const newPet = new Pets({ namePet, breed, age, gender, description });
    await newPet.save();
    return res.status(200).json({ success: true, newPet });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
const getAllPets = asyncHandler(async (req, res) => {
  try {
    const pets = await Pets.find();
    return res.status(200).json({
      success: true,
      pets,
    });
  } catch (error) {
    throw new Error(error);
  }
});
const deletePet = asyncHandler(async (req, res) => {
  try {
    const { pid } = req.params;
    if (!pid) throw new Error("Missing Id!!");
    const pets = await Pets.findByIdAndDelete(pid);
    return res.status(200).json({
      success: pets ? true : false,
      deletePets: pets ? `Sucessfully` : "No pet is deleted",
    });
  } catch (error) {
    throw new Error(error);
  }
});
const changePets = asyncHandler(async (req, res) => {
  try {
    const { pid } = req.params;
    const { namePet, age, gender, description } = req.body;
    const updatePets = await Pets.findByIdAndUpdate(
      pid,
      { namePet, age, gender, description },
      { new: true }
    );
    if (!updatePets) {
      return res
        .status(404)
        .json({ success: false, message: "Can not find pets!!!" });
    }
    return res.status(200).json({
      success: true,
      message: updatePets,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Error update.",
    });
  }
});
const getCurrentPets = asyncHandler(async (req, res) => {
  try {
    const { pid } = req.params;
    const existingPets = await Pets.findById(pid).select("-_id -__v");
    if (!existingPets) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy thú cưng!!!" });
    }
    return res.status(200).json({ success: true, pet: existingPets });
  } catch (error) {
    return res.status(400).json({ success: false, message: "Lỗi." });
  }
});

module.exports = {
  createNewPets,
  getAllPets,
  deletePet,
  changePets,
  getCurrentPets,
};
