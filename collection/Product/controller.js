const { default: mongoose } = require("mongoose");
const asyncHandler = require("express-async-handler");
const Product = require("./model");
const Brand = require("../Brand/model");

const createProduct = asyncHandler(async (req, res) => {
  try {
    const { nameProduct, brandID, quantity, price, description } = req.body;
    const images = req.files.map((file) => file.path);

    if (!mongoose.Types.ObjectId.isValid(brandID)) {
      return res.status(400).json({ message: "Invalid brand ID" });
    }

    const existingBrand = await Brand.findById(brandID);
    if (!existingBrand) {
      return res
        .status(404)
        .json({ message: "Brand not found with the provided ID" });
    }

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

    await newProduct.save();

    return res
      .status(200)
      .json({ success: true, message: "Add product successfully", newProduct });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const getAllProduct = asyncHandler(async (req, res) => {
  try {
    const product = await Product.find();
    return res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    throw new Error(error);
  }
});

const getCurrentProduct = asyncHandler(async (req, res) => {
  try {
    const { prodid } = req.params;
    const existing = await Product.findById(prodid);
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy thú cưng!!!" });
    }
    return res.status(200).json({
      success: true,
      existing,
    });
  } catch (error) {
    throw new Error(error);
  }
});

const changeProduct = asyncHandler(async (req, res) => {
  try {
    const { productId } = req.params;
    const { nameProduct, quantity, price, description } = req.body;
    if (!productId) throw new Error("Missing Id!!");

    const update = await Product.findByIdAndUpdate(
      productId,
      { nameProduct, quantity, price, description },
      { new: true }
    );
    if (!update) {
      return res
        .status(404)
        .json({ success: false, message: "Can not find!!!" });
    }
    return res.status(200).json({
      success: true,
      message: update,
    });
  } catch (error) {
    throw new Error(error);
  }
});

const deleteProduct = asyncHandler(async (req, res) => {
  try {
    const { productId } = req.params;
    if (!productId) throw new Error("Missing Id!!");

    const product = await Product.findByIdAndDelete(productId);
    return res.status(200).json({
      success: product ? true : false,
      delete: product ? `Sucessfully` : "No brand is deleted",
    });
  } catch (error) {
    throw new Error(error);
  }
});

module.exports = {
  createProduct,
  getAllProduct,
  changeProduct,
  deleteProduct,
  getCurrentProduct,
};
