const PetToys = require("./model");
const Brand = require("../Brand/model");
const { default: mongoose } = require("mongoose");
const asyncHandler = require("express-async-handler");

const createToys = asyncHandler(async (req, res) => {
  try {
    const { nameToy, brandID, type, material, price, quantity } = req.body;
    if (!mongoose.Types.ObjectId.isValid(brandID)) {
      return res.status(400).json({ message: "ID Brand invalid!!!!" });
    }
    const existingBrand = await Brand.findById(brandID);
    if (!existingBrand) {
      return res.status(404).json({ message: "Not found brand with Id" });
    }
    const newToys = new PetToys({
      nameToy,
      brand: { brandID, brandName: existingBrand.nameBrand },
      type,
      material,
      price,
      quantity,
    });
    await newToys.save();
    return res.status(200).json({ success: true, newToys });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = {
  createToys,
};
