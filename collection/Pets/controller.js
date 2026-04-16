const { default: mongoose } = require("mongoose");
const asyncHandler = require("express-async-handler");
const Pets = require("./model");
const PetBreed = require("../PetBreed/model");
const petRatingService = require("../../service/petRatingService");
const { ERROR_CODES } = require("../../utils/apiResponse");
const { HttpError } = require("../../utils/httpError");

const formatString = (input) => {
  const words = input.split("-");
  const formattedWords = words.map(
    (word) => word.charAt(0).toUpperCase() + word.slice(1)
  );

  return formattedWords.join(" ");
};
const createNewPets = asyncHandler(async (req, res) => {
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
  const imgPet = (req.files || []).map((file) => file.path);
  if (!mongoose.Types.ObjectId.isValid(breed)) {
    throw new HttpError(400, "Invalid breed ID", ERROR_CODES.VALIDATION);
  }
  const existingBreed = await PetBreed.findById(breed);
  if (!existingBreed) {
    throw new HttpError(
      404,
      "Breed not found with the provided ID",
      ERROR_CODES.NOT_FOUND
    );
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
});

/** Escape string for safe use inside RegExp */
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const getPagination = (query = {}) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(1000, Math.max(1, Number(query.limit) || 1000));
  return { page, limit, skip: (page - 1) * limit };
};
const getSort = (query = {}, allowed = [], fallback = "namePet") => {
  const raw = String(query.sort || "").trim();
  if (!raw) return fallback;
  const dir = raw.startsWith("-") ? -1 : 1;
  const field = raw.replace(/^-/, "");
  if (!allowed.includes(field)) return fallback;
  return { [field]: dir };
};
const getFields = (query = {}, allowed = []) => {
  const raw = String(query.fields || "").trim();
  if (!raw) return "";
  const picked = raw
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x && allowed.includes(x));
  return picked.join(" ");
};
const ADMIN_SEARCH_CACHE_TTL_MS = 15000;
const adminSearchCache = new Map();
const getCachedAdminSearch = (key) => {
  const hit = adminSearchCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expireAt) {
    adminSearchCache.delete(key);
    return null;
  }
  return hit.value;
};
const setCachedAdminSearch = (key, value) => {
  adminSearchCache.set(key, {
    value,
    expireAt: Date.now() + ADMIN_SEARCH_CACHE_TTL_MS,
  });
};
const buildSpeciesFilter = (specie, q) => {
  const formattedSpecie = formatString(specie);
  const baseFilter = { "petBreed.nameSpecies": formattedSpecie };
  if (!q) return baseFilter;
  const regex = new RegExp(escapeRegex(q), "i");
  return {
    ...baseFilter,
    $or: [
      { namePet: regex },
      { "petBreed.nameBreed": regex },
      { description: regex },
      { characteristic: regex },
    ],
  };
};
const toSafeQuantity = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
};
const SORT_QUERY_TO_OPTION = {
  "a-z": { namePet: 1 },
  "z-a": { namePet: -1 },
  latest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  "price-low-to-high": { price: 1 },
  "price-high-to-low": { price: -1 },
};
const getPetSortOption = (sortKey) => SORT_QUERY_TO_OPTION[sortKey] || {};
const parsePriceRange = ({ minPrice, maxPrice }) => {
  if (minPrice && isNaN(minPrice)) {
    return { error: "Invalid min price", range: null };
  }
  if (maxPrice && isNaN(maxPrice)) {
    return { error: "Invalid max price", range: null };
  }
  const range = {};
  if (minPrice) range.$gte = parseFloat(minPrice);
  if (maxPrice) range.$lte = parseFloat(maxPrice);
  return { error: null, range };
};

const PET_SELECT_FIELDS = [
  "_id",
  "namePet",
  "imgPet",
  "petBreed",
  "age",
  "gender",
  "description",
  "price",
  "quantity",
  "deworming",
  "vaccination",
  "characteristic",
  "sold",
  "createdAt",
  "updatedAt",
];

const getAllPets = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const sort = getSort(req.query, ["namePet", "price", "createdAt"], "createdAt");
  const select = getFields(req.query, PET_SELECT_FIELDS);
  const [allPets, total] = await Promise.all([
    Pets.find().select(select).sort(sort).skip(skip).limit(limit),
    Pets.countDocuments({}),
  ]);
  return res.status(200).json({
    success: true,
    data: allPets,
    pets: allPets,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
});

/**
 * Admin: pets theo loài (Dog/Cat), tìm theo tên thú, tên giống, mô tả (MongoDB regex, không phân biệt hoa thường).
 * GET /admin/search/:specie?q=
 */
const searchPetsForAdmin = asyncHandler(async (req, res) => {
  const { specie } = req.params;
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

  if (!specie) {
    throw new HttpError(
      400,
      "Thiếu tham số loài (Dog / Cat).",
      ERROR_CODES.VALIDATION
    );
  }

  const { page, limit, skip } = getPagination(req.query);
  const sort = getSort(req.query, ["namePet", "price", "createdAt"], "namePet");
  const select = getFields(req.query, PET_SELECT_FIELDS);
  const cacheKey = JSON.stringify({
    specie,
    q,
    page,
    limit,
    sort: req.query.sort || "",
    fields: req.query.fields || "",
  });
  const cached = getCachedAdminSearch(cacheKey);
  if (cached) return res.status(200).json(cached);

  const filter = buildSpeciesFilter(specie, q);

  const [pets, total] = await Promise.all([
    Pets.find(filter).select(select).sort(sort).skip(skip).limit(limit),
    Pets.countDocuments(filter),
  ]);

  const payload = {
    success: true,
    data: pets,
    pets,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
  setCachedAdminSearch(cacheKey, payload);
  return res.status(200).json(payload);
});

const getNextData = asyncHandler(async (req, res) => {
  const { pid } = req.params;

  const pets = await Pets.find().sort({ createdAt: 1 });

  if (!pets.length) {
    throw new HttpError(404, "Không có thú nào", ERROR_CODES.NOT_FOUND);
  }

  const index = pets.findIndex((p) => p._id.toString() === pid);

  if (index === -1) {
    throw new HttpError(
      404,
      "Không tìm thấy thú với id này",
      ERROR_CODES.NOT_FOUND
    );
  }

  const nextIndex = (index + 1) % pets.length;
  const nextPet = pets[nextIndex];

  return res.status(200).json({ success: true, pet: nextPet });
});

const deletePet = asyncHandler(async (req, res) => {
  const { pid } = req.params;
  if (!pid) {
    throw new HttpError(400, "Missing Id", ERROR_CODES.VALIDATION);
  }
  const pets = await Pets.findByIdAndDelete(pid);
  return res.status(200).json({
    success: Boolean(pets),
    deletePets: pets ? "Successfully" : "No pet is deleted",
  });
});

const changePets = asyncHandler(async (req, res) => {
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

  const pet = await Pets.findById(pid);
  if (!pet) {
    throw new HttpError(404, "Can not find pet!", ERROR_CODES.NOT_FOUND);
  }

  const qtyProvided = quantity !== undefined && quantity !== null && quantity !== "";
  const safeQty = qtyProvided
    ? toSafeQuantity(quantity, 0)
    : toSafeQuantity(pet.quantity, 0);

  const updatePets = await Pets.findByIdAndUpdate(
    pid,
    {
      namePet,
      age,
      gender,
      description,
      price,
      ...(qtyProvided ? { quantity: safeQty } : {}),
      deworming,
      vaccination,
      characteristic,
      sold: safeQty > 0 ? false : true,
    },
    { new: true }
  );

  return res.status(200).json({
    success: true,
    message: updatePets,
  });
});

const getCurrentPets = asyncHandler(async (req, res) => {
  const { pid } = req.params;
  const existingPets = await Pets.findById(pid).select("-_id -__v");
  if (!existingPets) {
    throw new HttpError(
      404,
      "Không tìm thấy thú cưng!!!",
      ERROR_CODES.NOT_FOUND
    );
  }
  return res.status(200).json({ success: true, pet: existingPets });
});

const getCurrentPetsByName = asyncHandler(async (req, res) => {
  const { pName } = req.params;
  const parts = pName.trim().split(" ");
  const lastPart = parts[parts.length - 1];

  const regexNamePet = new RegExp(lastPart, "i");

  const existingPets = await Pets.find({
    $or: [
      { namePet: { $regex: regexNamePet } },
      { namePet: { $regex: new RegExp(pName, "i") } },
    ],
  }).select("-__v");

  if (!existingPets.length) {
    throw new HttpError(
      404,
      "Không tìm thấy thú cưng!!!",
      ERROR_CODES.NOT_FOUND
    );
  }

  return res.status(200).json({ success: true, data: existingPets, pets: existingPets });
});

const getPetBySpecies = asyncHandler(async (req, res) => {
  const { specie } = req.params;
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

  if (!specie) {
    throw new HttpError(
      400,
      "Species parameter is required",
      ERROR_CODES.VALIDATION
    );
  }

  const { page, limit, skip } = getPagination(req.query);
  const sort = getSort(req.query, ["namePet", "price", "createdAt"], "namePet");
  const select = getFields(req.query, PET_SELECT_FIELDS);
  const filter = buildSpeciesFilter(specie, q);

  const [pets, total] = await Promise.all([
    Pets.find(filter).select(select).sort(sort).skip(skip).limit(limit),
    Pets.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    data: pets,
    pets,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
});

const getPetByBreed = asyncHandler(async (req, res) => {
  const { breed } = req.params;

  if (!breed) {
    throw new HttpError(
      400,
      "Breed parameter is required",
      ERROR_CODES.VALIDATION
    );
  }

  const formattedBreed = formatString(breed);

  const pets = await Pets.find({ "petBreed.nameBreed": formattedBreed });
  if (pets.length === 0) {
    throw new HttpError(
      404,
      `No pets found for breed: ${formattedBreed}`,
      ERROR_CODES.NOT_FOUND
    );
  }

  return res.status(200).json({ success: true, data: pets, pets });
});

const sortingPet = asyncHandler(async (req, res) => {
  const { breed } = req.params;
  const { sort } = req.query;
  const sortOption = getPetSortOption(sort);
  const formattedBreed = formatString(breed);
  const pets = await Pets.find({
    "petBreed.nameBreed": formattedBreed,
  }).sort(sortOption);
  if (pets.length === 0) {
    throw new HttpError(
      404,
      `No pets found for breed: ${formattedBreed}`,
      ERROR_CODES.NOT_FOUND
    );
  }
  return res.status(200).json(pets);
});
const filterPricePet = asyncHandler(async (req, res) => {
  const { breed } = req.params;
  const { minPrice, maxPrice } = req.query;
  const { error: priceError, range: priceQuery } = parsePriceRange({
    minPrice,
    maxPrice,
  });
  if (priceError) {
    throw new HttpError(400, priceError, ERROR_CODES.VALIDATION);
  }
  const formattedBreed = formatString(breed);
  const pets = await Pets.find({
    "petBreed.nameBreed": formattedBreed,
    price: priceQuery,
  });

  if (pets.length === 0) {
    throw new HttpError(
      404,
      "No pets found in this price range",
      ERROR_CODES.NOT_FOUND
    );
  }
  return res.status(200).json(pets);
});

const postRating = asyncHandler(async (req, res) => {
  const { star, comment } = req.body;
  const postBy = req.user?._id;
  const { petId } = req.params;
  const newFiles = (req.files || []).map((file) => file.path);
  try {
    const { action, pet } = await petRatingService.upsertPetRating({
      petId,
      postBy,
      star,
      comment,
      newFiles,
    });
    if (action === "updated") {
      return res.status(200).json({
        success: true,
        message: "Rating updated successfully.",
        pet,
      });
    }
    return res.status(200).json({
      success: true,
      message: "Rating added successfully.",
      pet,
    });
  } catch (error) {
    if (error.status === 400) {
      throw new HttpError(400, error.message, ERROR_CODES.VALIDATION);
    }
    if (error.status === 404) {
      throw new HttpError(404, error.message, ERROR_CODES.NOT_FOUND);
    }
    throw error;
  }
});

const deleteRating = asyncHandler(async (req, res) => {
  try {
    const { petId } = req.params;
    const postBy = req.user?._id;
    const { pet } = await petRatingService.deletePetRating({ petId, postBy });
    return res.status(200).json({
      success: true,
      message: "Rating deleted successfully.",
      pet,
    });
  } catch (error) {
    if (error.status === 404) {
      throw new HttpError(404, error.message, ERROR_CODES.NOT_FOUND);
    }
    throw error;
  }
});

module.exports = {
  createNewPets,
  getAllPets,
  searchPetsForAdmin,
  getNextData,
  deletePet,
  changePets,
  getCurrentPets,
  getPetByBreed,
  sortingPet,
  filterPricePet,
  getCurrentPetsByName,
  getPetBySpecies,
  postRating,
  deleteRating,
};
