const { default: mongoose } = require("mongoose");
const asyncHandler = require("express-async-handler");
const Product = require("./model");
const Brand = require("../Brand/model");

const createProduct = asyncHandler(async (req, res) => {
  try {
    const { nameProduct, brandID, quantity, price, description } = req.body;
    const images = req.files.map((file) => file.path);

    // Kiểm tra tính hợp lệ của brandID
    if (!mongoose.Types.ObjectId.isValid(brandID)) {
      return res.status(400).json({ message: "Invalid brand ID" });
    }

    // Tìm kiếm brand với brandID
    const existingBrand = await Brand.findById(brandID);
    if (!existingBrand) {
      return res
        .status(404)
        .json({ message: "Brand not found with the provided ID" });
    }

    // Tạo sản phẩm mới
    const newProduct = new Product({
      nameProduct,
      brand: {
        _id: existingBrand._id,
        nameBrand: existingBrand.nameBrand,
        nameCate: existingBrand.category.nameCate,
      },
      quantity,
      price,
      description,
      images,
    });

    // Lưu sản phẩm vào cơ sở dữ liệu
    await newProduct.save();

    return res
      .status(200)
      .json({ success: true, message: "Add product successfully", newProduct });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const getAllProduct = asyncHandler(async (req, res) => {});

module.exports = { createProduct, getAllProduct };
