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

const getAllBrand = asyncHandler(async (req, res) => {
  try {
    const brands = await Brand.find();
    return res.status(200).json({
      success: true,
      brands,
    });
  } catch (error) {
    throw new Error(error);
  }
});

const changeBrand = asyncHandler(async (req, res) => {
  try {
    const { brandId } = req.params;
    const { nameBrand } = req.body;
    if (!brandId) throw new Error("Missing Id!!");

    const updateName = await Brand.findByIdAndUpdate(
      brandId,
      { nameBrand },
      { new: true }
    );
    if (!updateName) {
      return res
        .status(404)
        .json({ success: false, message: "Can not find!!!" });
    }
    return res.status(200).json({
      success: true,
      message: updateName,
    });
  } catch (error) {
    throw new Error(error);
  }
});

const deleteBrand = asyncHandler(async (req, res) => {
  try {
    const { brandId } = req.params;
    if (!brandId) throw new Error("Missing Id!!");

    const brand = await Brand.findByIdAndDelete(brandId);
    return res.status(200).json({
      success: brand ? true : false,
      delete: brand ? `Sucessfully` : "No brand is deleted",
    });
  } catch (error) {
    throw new Error(error);
  }
});

module.exports = {
  createBrand,
  getAllBrand,
  changeBrand,
  deleteBrand,
};
