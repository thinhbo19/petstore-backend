const PetSpecies = require("./model");
const asyncHandler = require("express-async-handler");
const { HttpError } = require("../../utils/httpError");
const { ERROR_CODES } = require("../../utils/apiResponse");

const createNewPetSpecies = asyncHandler(async (req, res) => {
  const { nameSpecies } = req.body;
  const existingPetSpecies = await PetSpecies.findOne({ nameSpecies });
  if (existingPetSpecies) {
    throw new HttpError(
      400,
      "Pet Species is existing!!",
      ERROR_CODES.VALIDATION
    );
  }
  const newPetSpecies = new PetSpecies({ nameSpecies });
  const savedPetSpecies = await newPetSpecies.save();
  return res.status(201).json({ success: true, data: savedPetSpecies });
});
const getAllPetSpecies = asyncHandler(async (req, res) => {
  const petSpecie = await PetSpecies.find();
  return res.status(200).json({
    success: true,
    data: petSpecie,
    petSpecie,
  });
});
const changePetSpecies = asyncHandler(async (req, res) => {
  const { psid } = req.params;
  const { nameSpecies } = req.body;
  const updateNameSpecies = await PetSpecies.findByIdAndUpdate(
    psid,
    { nameSpecies },
    { new: true }
  );
  if (!updateNameSpecies) {
    throw new HttpError(
      404,
      "Can not find pet species!!!",
      ERROR_CODES.NOT_FOUND
    );
  }
  return res.status(200).json({
    success: true,
    data: updateNameSpecies,
    message: "Update pet species successfully",
  });
});
const deletePetSpecies = asyncHandler(async (req, res) => {
  const { psid } = req.params;
  if (!psid) {
    throw new HttpError(400, "Missing Id!!", ERROR_CODES.VALIDATION);
  }
  const petSpecie = await PetSpecies.findByIdAndDelete(psid);
  return res.status(200).json({
    success: Boolean(petSpecie),
    deletePetSpecies: petSpecie ? "Successfully" : "No pet species is deleted",
  });
});

module.exports = {
  createNewPetSpecies,
  getAllPetSpecies,
  changePetSpecies,
  deletePetSpecies,
};
