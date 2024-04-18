const Brand = require("../models/brand");
const { default: mongoose } = require("mongoose");
const asyncHandler = require("express-async-handler");

const createBrand = asyncHandler(async (req, res) => {
  try {
    const { nameBrand } = req.body;
    const newBrand = new Brand({ nameBrand });
    await newBrand.save();
    return res.status(200).json({ success: true, newBrand });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = {
  createBrand,
};
