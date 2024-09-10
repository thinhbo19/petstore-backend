const { default: mongoose } = require("mongoose");
const asyncHandler = require("express-async-handler");
const Pets = require("./model");
const PetBreed = require("../PetBreed/model");

const formatString = (input) => {
  return input
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

const createNewPets = asyncHandler(async (req, res) => {
  try {
    const {
      namePet,
      breed,
      age,
      gender,
      description,
      price,
      quantity,
      deworming,
      vaccination,
      characteristic,
    } = req.body;
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
      quantity,
      deworming,
      vaccination,
      characteristic,
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
    const {
      namePet,
      age,
      gender,
      description,
      price,
      quantity,
      deworming,
      vaccination,
      characteristic,
    } = req.body;
    const updatePets = await Pets.findByIdAndUpdate(
      pid,
      {
        namePet,
        age,
        gender,
        description,
        price,
        quantity,
        deworming,
        vaccination,
        characteristic,
      },
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

const getCurrentPetsByName = asyncHandler(async (req, res) => {
  try {
    const { pName } = req.params;
    const regexNamePet = new RegExp(pName, "i");

    const existingPets = await Pets.findOne({
      namePet: { $regex: regexNamePet },
    }).select("-__v");

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

const getPetByBreed = asyncHandler(async (req, res) => {
  const { breed } = req.params;

  if (!breed) {
    res.status(400);
    throw new Error("Breed parameter is required");
  }

  try {
    const formattedBreed = formatString(breed);
    console.log(formattedBreed);
    const pets = await Pets.find({ "petBreed.nameBreed": formattedBreed });
    if (pets.length === 0) {
      return res.status(404).json({
        message: `No pets found for breed: ${formattedBreed}`,
      });
    }

    res.status(200).json(pets);
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

module.exports = getPetByBreed;

const sortingPet = asyncHandler(async (req, res) => {
  const { breed } = req.params;
  const { sort } = req.query;
  let sortOption = {};

  switch (sort) {
    case "a-z":
      sortOption = { namePet: 1 }; // Sort by letter: A to Z
      break;
    case "z-a":
      sortOption = { namePet: -1 }; // Sort by letter: Z to A
      break;
    case "latest":
      sortOption = { createdAt: -1 }; // Sort by latest
      break;
    case "oldest":
      sortOption = { createdAt: 1 }; // Sort by oldest
      break;
    case "price-low-to-high":
      sortOption = { price: 1 }; // Sort by price: Low to High
      break;
    case "price-high-to-low":
      sortOption = { price: -1 }; // Sort by price: High to Low
      break;
    default:
      sortOption = {}; // No sorting
  }

  try {
    const pets = await Pets.find({
      "petBreed.nameBreed": breed,
    }).sort(sortOption);
    if (pets.length === 0) {
      return res
        .status(404)
        .json({ message: `No pets found for breed: ${breed}` });
    }
    return res.status(200).json(pets);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});
const filterPricePet = asyncHandler(async (req, res) => {
  const { breed } = req.params;
  const { minPrice, maxPrice } = req.query;

  let priceQuery = {};
  if (minPrice && isNaN(minPrice)) {
    return res.status(400).json({ message: "Invalid min price" });
  }
  if (maxPrice && isNaN(maxPrice)) {
    return res.status(400).json({ message: "Invalid max price" });
  }
  if (minPrice) {
    priceQuery.$gte = parseFloat(minPrice);
  }
  if (maxPrice) {
    priceQuery.$lte = parseFloat(maxPrice);
  }
  try {
    const pets = await Pets.find({
      "petBreed.breedID": breed,
      price: priceQuery,
    });

    if (pets.length === 0) {
      return res.status(404).json({
        data: pets,
        message: "No pets found in this price range",
      });
    }
    return res.status(200).json(pets);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = {
  createNewPets,
  getAllPets,
  deletePet,
  changePets,
  getCurrentPets,
  getPetByBreed,
  sortingPet,
  filterPricePet,
  getCurrentPetsByName,
};
