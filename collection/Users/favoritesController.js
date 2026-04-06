const asyncHandler = require("express-async-handler");
const User = require("./model");
const Pet = require("../Pets/model");
const Product = require("../Product/model");
const { generateSlug } = require("../../service/slugifyConfig");

const addFavorite = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const { pid } = req.body;

  try {
    const user = await User.findById(_id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const existingPetIndex = user.favorites.findIndex(
      (pet) => pet.id.toString() === pid,
    );

    if (existingPetIndex !== -1) {
      user.favorites.splice(existingPetIndex, 1);
      await user.save();
      return res.status(200).json({
        data: user.favorites,
        message:
          "The pet has been successfully removed from your favorite list",
      });
    }

    let existingData = await Pet.findById(pid);
    if (!existingData) {
      existingData = await Product.findById(pid);
      if (existingData) {
        user.favorites.push({
          id: pid,
          img: existingData.images[0],
          name: existingData.nameProduct,
          type: "Product",
          price: existingData.price,
          url: `/accessories/${generateSlug(existingData.nameProduct)}`,
        });
      } else {
        return res.status(404).json({ message: "Item not found" });
      }
    } else {
      let url = "";
      if (existingData.type === "Cat") {
        url = `/cats/${generateSlug(existingData.namePet)}`;
      } else {
        url = `/dogs/${generateSlug(existingData.namePet)}`;
      }
      user.favorites.push({
        id: pid,
        img: existingData.imgPet[0],
        name: existingData.namePet,
        type: "Pet",
        price: existingData.price,
        url: url,
      });
    }

    await user.save();
    return res.status(201).json({
      message: "The item has been added to your favorite list",
      data: user.favorites,
    });
  } catch (error) {
    console.error("Error while adding favorite item:", error);
    return res
      .status(500)
      .json({ message: "An error occurred while adding favorite item" });
  }
});

const getFavorites = asyncHandler(async (req, res) => {
  const { _id } = req.user;

  try {
    const user = await User.findById(_id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const allFavorites = user.favorites;
    allFavorites.sort((a, b) => b.createdAt - a.createdAt);

    return res.status(200).json({
      message: "List of favorite items",
      favorites: allFavorites.reverse(),
    });
  } catch (error) {
    console.error("Error while fetching favorites:", error);
    return res
      .status(500)
      .json({ message: "An error occurred while fetching favorites" });
  }
});

module.exports = {
  addFavorite,
  getFavorites,
};
