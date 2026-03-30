const { default: mongoose } = require("mongoose");
const asyncHandler = require("express-async-handler");
const Pets = require("./model");
const PetBreed = require("../PetBreed/model");
const User = require("../Users/model");

const formatString = (input) => {
  const words = input.split("-");
  const formattedWords = words.map(
    (word) => word.charAt(0).toUpperCase() + word.slice(1)
  );

  return formattedWords.join(" ");
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
  try {
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
  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi server." });
  }
});

/**
 * Admin: pets theo loài (Dog/Cat), tìm theo tên thú, tên giống, mô tả (MongoDB regex, không phân biệt hoa thường).
 * GET /admin/search/:specie?q=
 */
const searchPetsForAdmin = asyncHandler(async (req, res) => {
  try {
    const { specie } = req.params;
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

    if (!specie) {
      return res.status(400).json({
        success: false,
        message: "Thiếu tham số loài (Dog / Cat).",
      });
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

    const formattedSpecie = formatString(specie);
    const baseFilter = { "petBreed.nameSpecies": formattedSpecie };
    const regex = q ? new RegExp(escapeRegex(q), "i") : null;
    const filter = q
      ? {
          ...baseFilter,
          $or: [
            { namePet: regex },
            { "petBreed.nameBreed": regex },
            { description: regex },
            { characteristic: regex },
          ],
        }
      : baseFilter;

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
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Lỗi tìm kiếm.",
    });
  }
});

const getNextData = asyncHandler(async (req, res) => {
  try {
    const { pid } = req.params;

    const pets = await Pets.find().sort({ createdAt: 1 });

    if (!pets.length) {
      return res
        .status(404)
        .json({ success: false, message: "Không có thú nào" });
    }

    const index = pets.findIndex((p) => p._id.toString() === pid);

    if (index === -1) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy thú với id này" });
    }

    const nextIndex = (index + 1) % pets.length;
    const nextPet = pets[nextIndex];

    return res.status(200).json({ success: true, pet: nextPet });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
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

    const pet = await Pets.findById(pid);
    if (!pet) {
      return res.status(404).json({
        success: false,
        message: "Can not find pet!",
      });
    }

    const qtyProvided =
      quantity !== undefined && quantity !== null && quantity !== "";
    const parsedQty = qtyProvided ? Number(quantity) : Number(pet.quantity);
    const safeQty = Number.isFinite(parsedQty)
      ? Math.max(0, Math.floor(parsedQty))
      : 0;

    const updatePets = await Pets.findByIdAndUpdate(
      pid,
      {
        namePet: namePet,
        age: age,
        gender: gender,
        description: description,
        price: price,
        ...(qtyProvided ? { quantity: safeQty } : {}),
        deworming: deworming,
        vaccination: vaccination,
        characteristic: characteristic,
        sold: safeQty > 0 ? false : true,
      },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: updatePets,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Error updating pet.",
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
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy thú cưng!!!" });
    }

    return res.status(200).json({ success: true, pets: existingPets });
  } catch (error) {
    return res.status(400).json({ success: false, message: "Lỗi." });
  }
});

const getPetBySpecies = asyncHandler(async (req, res) => {
  const { specie } = req.params;
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

  if (!specie) {
    return res.status(400).json({ message: "Species parameter is required" });
  }

  try {
    const { page, limit, skip } = getPagination(req.query);
    const sort = getSort(req.query, ["namePet", "price", "createdAt"], "namePet");
    const select = getFields(req.query, [
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
    ]);
    const formattedSpecie = formatString(specie);
    const baseFilter = { "petBreed.nameSpecies": formattedSpecie };
    const regex = q ? new RegExp(escapeRegex(q), "i") : null;
    const filter = q
      ? {
          ...baseFilter,
          $or: [
            { namePet: regex },
            { "petBreed.nameBreed": regex },
            { description: regex },
            { characteristic: regex },
          ],
        }
      : baseFilter;

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
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
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

const postRating = asyncHandler(async (req, res) => {
  try {
    const { star, comment } = req.body;
    const postBy = req.user?._id;

    const newFiles = (req.files || []).map((file) => file.path);

    const { petId } = req.params;

    const pet = await Pets.findById(petId);
    const user = await User.findById(postBy);

    if (!pet) {
      throw new Error("Pet not found");
    }
    if (!user) {
      throw new Error("user not found");
    }
    if (!postBy || !star || !comment) {
      res.status(400);
      throw new Error(
        "Please provide complete information: postBy, star, comment."
      );
    }

    if (star < 1 || star > 5) {
      res.status(400);
      throw new Error("The number of stars must be between 1 and 5.");
    }

    const existingRatingIndex = pet.rating.findIndex(
      (r) => r.postBy.toString() === postBy
    );
    let feedback_img = newFiles;
    if (existingRatingIndex !== -1 && newFiles.length === 0) {
      const prev = pet.rating[existingRatingIndex].feedback_img || [];
      feedback_img = Array.isArray(prev) ? [...prev] : [];
    }
    if (existingRatingIndex !== -1) {
      pet.rating[existingRatingIndex] = {
        postBy,
        username: user.username,
        avatar: user.Avatar,
        star,
        comment,
        dateComment: Date.now(),
        feedback_img,
      };
    } else {
      pet.rating.push({
        postBy,
        username: user.username,
        avatar: user.Avatar,
        star,
        comment,
        dateComment: Date.now(),
        feedback_img,
      });
    }
    await pet.save();
    if (existingRatingIndex !== -1) {
      res.status(200).json({
        success: true,
        message: "Rating updated successfully.",
        pet,
      });
    } else {
      res.status(200).json({
        success: true,
        message: "Rating added successfully.",
        pet,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi máy chủ",
    });
  }
});

const deleteRating = asyncHandler(async (req, res) => {
  try {
    const { petId } = req.params;
    const postBy = req.user?._id;

    const pet = await Pets.findById(petId); // Tìm thú cưng theo ID

    if (!pet) {
      return res.status(404).json({
        success: false,
        message: "Pet not found",
      });
    }

    const existingRatingIndex = pet.rating.findIndex(
      (r) => r.postBy.toString() === postBy
    );

    if (existingRatingIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Rating not found",
      });
    }

    pet.rating.splice(existingRatingIndex, 1);
    await pet.save();

    return res.status(200).json({
      success: true,
      message: "Rating deleted successfully.",
      pet,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
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
