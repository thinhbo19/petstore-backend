const { default: mongoose } = require("mongoose");
const PetModel = require("../collection/Pets/model");
const ProdModel = require("../collection/Product/model");
const asyncHandler = require("express-async-handler");

const getData = asyncHandler(async (req, res) => {
  try {
    const { pid } = req.params;

    const existingPets = await PetModel.findById(pid);
    if (existingPets) {
      return res.status(200).json({ success: true, data: "Pet" });
    }

    const existingProd = await ProdModel.findById(pid);
    if (existingProd) {
      return res.status(200).json({ success: true, data: "Prod" });
    }

    return res.status(404).json({
      success: false,
      message: "Không tìm thấy thú cưng hoặc sản phẩm!",
    });
  } catch (error) {
    return res
      .status(400)
      .json({ success: false, message: "Lỗi.", error: error.message });
  }
});

module.exports = { getData };
