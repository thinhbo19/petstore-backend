const { default: mongoose } = require("mongoose");
const PetBreed = require("./model");
const asyncHandler = require("express-async-handler");
const PetSpecies = require("../PetSpecies/model");

const createNewBreed = asyncHandler(async (req, res) => {
  const { nameBreed, speciesID } = req.body;
  const imgBreed = req.files.map((file) => file.path);
  try {
    if (!mongoose.Types.ObjectId.isValid(speciesID)) {
      return res.status(400).json({ message: "Invalid species ID" });
    }
    const existingSpecies = await PetSpecies.findById(speciesID);
    if (!existingSpecies) {
      return res.status(404).json({ message: "Species not found" });
    }
    const existingBreed = await PetBreed.findOne({ nameBreed });
    if (existingBreed) {
      return res.status(400).json({ message: "Breed name already exists" });
    }
    const newPetBreed = new PetBreed({
      nameBreed,
      imgBreed,
      petSpecies: { speciesID, nameSpecies: existingSpecies.nameSpecies },
    });
    await newPetBreed.save();

    return res.status(201).json({ success: true, newPetBreed });
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
