const { default: mongoose } = require("mongoose");
const PetBreed = require("./model");
const asyncHandler = require("express-async-handler");
const PetSpecies = require("../PetSpecies/model");
const {
  escapeRegex,
  getPagination,
  getSort,
  getFields,
} = require("../../utils/queryHelpers");
const { HttpError } = require("../../utils/httpError");
const { ERROR_CODES } = require("../../utils/apiResponse");

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
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const { page, limit, skip } = getPagination(req.query);
    const sort = getSort(req.query, ["nameBreed", "createdAt", "updatedAt"], "nameBreed");
    const select = getFields(req.query, [
      "_id",
      "nameBreed",
      "imgBreed",
      "petSpecies",
      "createdAt",
      "updatedAt",
    ]);
    const filter = q
      ? { nameBreed: { $regex: new RegExp(escapeRegex(q), "i") } }
      : {};
    const [petBreed, total] = await Promise.all([
      PetBreed.find(filter).select(select).sort(sort).skip(skip).limit(limit),
      PetBreed.countDocuments(filter),
    ]);
    return res.status(200).json({
      success: true,
      data: petBreed,
      petBreed,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    throw new Error(error);
  }
});
const changePetBreed = asyncHandler(async (req, res) => {
  const { bid } = req.params;
  const { nameBreed } = req.body;
  if (!nameBreed || typeof nameBreed !== "string") {
    return res.status(400).json({
      success: false,
      message: "Invalid 'nameBreed' parameter. It must be a non-empty string.",
    });
  }

  try {
    const updateNameBreed = await PetBreed.findByIdAndUpdate(
      bid,
      { nameBreed: nameBreed },
      { new: true }
    );

    if (!updateNameBreed) {
      return res.status(404).json({
        success: false,
        message: "Cannot find pet breed with the given ID.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Pet breed updated successfully.",
      data: updateNameBreed,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Server error. Unable to update pet breed.",
    });
  }
});
const getCurrentBreed = asyncHandler(async (req, res) => {
  try {
    const { bid } = req.params;
    const existingBreed = await PetBreed.findById(bid);
    if (!existingBreed) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy!!!" });
    }
    return res.status(200).json({ success: true, data: existingBreed, breed: existingBreed });
  } catch (error) {
    return res.status(400).json({ success: false, message: "Lỗi." });
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
const getBreedBySpecies = asyncHandler(async (req, res) => {
  const { species } = req.params;

  if (!species) {
    throw new HttpError(
      400,
      "Species parameter is required",
      ERROR_CODES.VALIDATION
    );
  }

  const breeds = await PetBreed.find({ "petSpecies.speciesID": species });

  if (breeds.length === 0) {
    throw new HttpError(
      404,
      `No breeds found for species: ${species}`,
      ERROR_CODES.NOT_FOUND
    );
  }

  return res.status(200).json({
    success: true,
    data: breeds,
    breeds,
  });
});

const getBreedByNameSpecies = asyncHandler(async (req, res) => {
  const { nameSpecies } = req.params;
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const { page, limit, skip } = getPagination(req.query);
  const sort = getSort(req.query, ["nameBreed", "createdAt", "updatedAt"], "nameBreed");
  const select = getFields(req.query, [
    "_id",
    "nameBreed",
    "imgBreed",
    "petSpecies",
    "createdAt",
    "updatedAt",
  ]);

  if (!nameSpecies) {
    throw new HttpError(
      400,
      "Species parameter is required",
      ERROR_CODES.VALIDATION
    );
  }

  const filter = {
    "petSpecies.nameSpecies": nameSpecies,
    ...(q ? { nameBreed: { $regex: new RegExp(escapeRegex(q), "i") } } : {}),
  };
  const [breeds, total] = await Promise.all([
    PetBreed.find(filter).select(select).sort(sort).skip(skip).limit(limit),
    PetBreed.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: breeds,
    breeds,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
});

const sortingBreed = asyncHandler(async (req, res) => {
  const { species } = req.params;
  const { sort } = req.query;
  let sortOption = {};

  switch (sort) {
    case "a-z":
      sortOption = { nameBreed: 1 }; // Sort by letter: A to Z
      break;
    case "z-a":
      sortOption = { nameBreed: -1 }; // Sort by letter: Z to A
      break;
    case "latest":
      sortOption = { createdAt: -1 }; // Sort by latest
      break;
    case "oldest":
      sortOption = { createdAt: 1 }; // Sort by oldest
      break;
    default:
      sortOption = {}; // No sorting
  }

  const breeds = await PetBreed.find({
    "petSpecies.nameSpecies": species,
  }).sort(sortOption);
  if (breeds.length === 0) {
    throw new HttpError(
      404,
      `No breeds found for species: ${species}`,
      ERROR_CODES.NOT_FOUND
    );
  }
  return res.status(200).json({ success: true, data: breeds, breeds });
});

module.exports = {
  createNewBreed,
  getAllPetBreed,
  changePetBreed,
  deletePetBreed,
  getBreedBySpecies,
  getBreedByNameSpecies,
  sortingBreed,
  getCurrentBreed,
};
