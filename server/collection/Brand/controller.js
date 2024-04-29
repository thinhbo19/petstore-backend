const Brand = require("./model");
const Category = require("../Category/model");
const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");

const createBrand = asyncHandler(async (req, res) => {
  try {
    const { nameBrand, category } = req.body;
    if (!mongoose.Types.ObjectId.isValid(category)) {
      return res.status(400).json({ message: "Invalid category ID" });
    }
    const existingCate = await Category.findById(category);
    if (!existingCate) {
      return res
        .status(404)
        .json({ message: "Category not found with the provided ID" });
    }
    const newBrand = new Brand({
      nameBrand,
      category: { cateID: category, nameCate: existingCate.nameCategory },
    });
    await newBrand.save();
    return res.status(200).json({ success: true, newBrand });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
module.exports = {
  createBrand,
};
