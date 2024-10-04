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
        namePet: namePet,
        age: age,
        gender: gender,
        description: description,
        price: price,
        quantity: quantity,
        deworming: deworming,
        vaccination: vaccination,
        characteristic: characteristic,
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
    const { postBy, star, comment } = req.body;

    const feedback_img = req.files.map((file) => file.path);

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
    if (existingRatingIndex !== -1) {
      // Cập nhật đánh giá nếu đã tồn tại
      pet.rating[existingRatingIndex] = {
        postBy,
        username: user.username,
        avatar: user.Avatar,
        star,
        comment,
        dateComment: Date.now(),
        feedback_img: feedback_img,
      };
    } else {
      pet.rating.push({
        postBy,
        username: user.username,
        avatar: user.Avatar,
        star,
        comment,
        dateComment: Date.now(),
        feedback_img: feedback_img,
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
      mess: error.message,
    });
  }
});

const deleteRating = asyncHandler(async (req, res) => {
  try {
    const { petId } = req.params;
    const { postBy } = req.body;

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

    console.log(existingRatingIndex);
    if (!existingRatingIndex) {
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
  deletePet,
  changePets,
  getCurrentPets,
  getPetByBreed,
  sortingPet,
  filterPricePet,
  getCurrentPetsByName,
  postRating,
  deleteRating,
};
