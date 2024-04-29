const Category = require("./model");
const { default: mongoose } = require("mongoose");
const asyncHandler = require("express-async-handler");

const createCategory = asyncHandler(async (req, res) => {
  try {
    const { nameCategory } = req.body;
    const newCate = new Category({ nameCategory });
    await newCate.save();
    return res.status(200).json({ success: true, newCate });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = {
  createCategory,
};
