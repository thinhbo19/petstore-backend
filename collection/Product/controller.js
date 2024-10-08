const { default: mongoose } = require("mongoose");
const asyncHandler = require("express-async-handler");
const Product = require("./model");
const Category = require("../Category/model.js");

const formatString = (input) => {
  const words = input.split("-");
  const formattedWords = words.map(
    (word) => word.charAt(0).toUpperCase() + word.slice(1)
  );

  return formattedWords.join(" ");
};

const createProduct = asyncHandler(async (req, res) => {
  try {
    const { nameProduct, category, shortTitle, quantity, price, description } =
      req.body;
    const images = req.files.map((file) => file.path);

    if (!mongoose.Types.ObjectId.isValid(category)) {
      return res.status(400).json({ message: "Invalid category ID" });
    }

    const existingCate = await Category.findById(category);
    if (!existingCate) {
      return res
        .status(404)
        .json({ message: "Category not found with the provided ID" });
    }

    const newProduct = new Product({
      nameProduct,
      category: {
        categoryID: category,
        nameCate: existingCate.nameCategory,
      },
      shortTitle,
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

const getCurrentProductByName = asyncHandler(async (req, res) => {
  try {
    const { prodName } = req.params;
    const regexName = new RegExp(prodName, "i");

    const existingProd = await Product.findOne({
      nameProduct: { $regex: regexName },
    }).select("-__v");

    if (!existingProd) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy thú cưng!!!" });
    }
    return res.status(200).json({ success: true, prod: existingProd });
  } catch (error) {
    return res.status(400).json({ success: false, message: "Lỗi." });
  }
});

const findProductsByCategory = asyncHandler(async (req, res) => {
  const { nameCate } = req.params;
  try {
    const products = await Product.find({ "category.nameCate": nameCate });

    if (products.length > 0) {
      return res.status(200).json({
        success: true,
        message: `Found ${products.length} products in category: ${nameCate}`,
        products,
      });
    } else {
      return res.status(404).json({
        success: false,
        message: `No products found for category: ${nameCate}`,
      });
    }
  } catch (error) {
    console.error("Error finding products by category:", error);
    return res.status(500).json({
      success: false,
      message: "Could not fetch products",
      error: error.message,
    });
  }
});

module.exports = {
  createProduct,
  getAllProduct,
  changeProduct,
  deleteProduct,
  getCurrentProduct,
  getCurrentProductByName,
  findProductsByCategory,
};
