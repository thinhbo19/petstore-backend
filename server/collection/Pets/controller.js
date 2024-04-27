const { default: mongoose } = require("mongoose");
const asyncHandler = require("express-async-handler");
const Pets = require("./model");
const PetBreed = require("../PetBreed/model");

const createNewPets = asyncHandler(async (req, res) => {
  try {
    const { namePet, breed, age, gender, description, price } = req.body;
    const imgPet = req.files.map((file) => file.path);
    if (!mongoose.Types.ObjectId.isValid(breed)) {
      return res.status(400).json({ message: "Invalid breed ID" });
    }
    const existingBreed = await PetBreed.findById(breed);
    if (!existingBreed) {
      return res
        .status(404)
        .json({ message: "Breed not found with the provided ID" });
    }
    const newPet = new Pets({
      namePet,
      petBreed: {
        breedID: breed,
        nameBreed: existingBreed.nameBreed,
        nameSpecies: existingBreed.petSpecies.nameSpecies,
      },
      age,
      gender,
      description,
      imgPet,
      price,
    });
    await newPet.save();
    return res.status(201).json({ success: true, newPet });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const getAllPets = asyncHandler(async (req, res) => {
  try {
    const allPets = await Pets.find();
    return res.status(200).json({ success: true, pets: allPets });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi server." });
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
    const { namePet, age, gender, description, price } = req.body;
    const updatePets = await Pets.findByIdAndUpdate(
      pid,
      { namePet, age, gender, description, price },
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
