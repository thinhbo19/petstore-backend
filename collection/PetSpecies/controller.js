const PetSpecies = require("./model");
const asyncHandler = require("express-async-handler");

const createNewPetSpecies = asyncHandler(async (req, res) => {
  try {
    const { nameSpecies } = req.body;
    const existingPetSpecies = await PetSpecies.findOne({ nameSpecies });
    if (existingPetSpecies) {
      return res.status(400).json({ message: "Pet Species is exitsting!!" });
    }
    const newPetSpecies = new PetSpecies({ nameSpecies });
    const savedPetSpecies = await newPetSpecies.save();
    res.status(201).json(savedPetSpecies);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
const getAllPetSpecies = asyncHandler(async (req, res) => {
  try {
    const petSpecie = await PetSpecies.find();
    return res.status(200).json({
      success: true,
      petSpecie,
    });
  } catch (error) {
    throw new Error(error);
  }
});
const changePetSpecies = asyncHandler(async (req, res) => {
  try {
    const { psid } = req.params;
    const { nameSpecies } = req.body;
    const updateNameSpecies = await PetSpecies.findByIdAndUpdate(
      psid,
      { nameSpecies },
      { new: true }
    );
    if (!updateNameSpecies) {
      return res
        .status(404)
        .json({ success: false, message: "Can not find pet species!!!" });
    }
    return res.status(200).json({
      success: true,
      message: updateNameSpecies,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Error update.",
    });
  }
});
const deletePetSpecies = asyncHandler(async (req, res) => {
  try {
    const { psid } = req.params;
    if (!psid) throw new Error("Missing Id!!");
    const petSpecie = await PetSpecies.findByIdAndDelete(psid);
    return res.status(200).json({
      success: petSpecie ? true : false,
      deletePetSpecies: petSpecie ? `Sucessfully` : "No pet species is deleted",
    });
  } catch (error) {
    throw new Error(error);
  }
});

module.exports = {
  createNewPetSpecies,
  getAllPetSpecies,
  changePetSpecies,
  deletePetSpecies,
};
