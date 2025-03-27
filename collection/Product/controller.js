const { default: mongoose } = require("mongoose");
const asyncHandler = require("express-async-handler");
const Product = require("./model");
const Category = require("../Category/model.js");
const User = require("../Users/model");

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
      sold: false,
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
      {
        nameProduct,
        quantity,
        price,
        description,
        sold: quantity > 0 ? false : true,
      },
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

    const parts = prodName.trim().split(" ");
    const lastPart = parts[parts.length - 1];

    const regexName = new RegExp(lastPart, "i");

    const existingProd = await Product.find({
      $or: [
        { nameProduct: { $regex: regexName } },
        { nameProduct: { $regex: new RegExp(prodName, "i") } },
      ],
    }).select("-__v");

    if (!existingProd.length) {
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
  const { id } = req.params;
  try {
    const products = await Product.find({ "category.categoryID": id });

    if (products.length > 0) {
      return res.status(200).json({
        success: true,
        message: `Found ${products.length} products in category: ${id}`,
        products,
      });
    } else {
      return res.status(404).json({
        success: false,
        message: `No products found for category: ${id}`,
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
const postRating = asyncHandler(async (req, res) => {
  try {
    const { postBy, star, comment } = req.body;

    const feedback_img = req.files.map((file) => file.path);

    const { prodId } = req.params;

    const prod = await Product.findById(prodId);
    const user = await User.findById(postBy);

    if (!prod) {
      throw new Error("prod not found");
    }
    if (!user) {
      throw new Error("user not found");
    }
    if (!postBy || !star || !comment) {
      res.status(400);
      throw new Error(
        "Please provide complete information: postBy, star, comment."
      );
    }

    if (star < 1 || star > 5) {
      res.status(400);
      throw new Error("The number of stars must be between 1 and 5.");
    }

    const existingRatingIndex = prod.rating.findIndex(
      (r) => r.postBy.toString() === postBy
    );
    if (existingRatingIndex !== -1) {
      // Cập nhật đánh giá nếu đã tồn tại
      prod.rating[existingRatingIndex] = {
        postBy,
        username: user.username,
        avatar: user.Avatar,
        star,
        comment,
        dateComment: Date.now(),
        feedback_img: feedback_img,
      };
    } else {
      prod.rating.push({
        postBy,
        username: user.username,
        avatar: user.Avatar,
        star,
        comment,
        dateComment: Date.now(),
        feedback_img: feedback_img,
      });
    }
    await prod.save();
    if (existingRatingIndex !== -1) {
      res.status(200).json({
        success: true,
        message: "Rating updated successfully.",
        prod,
      });
    } else {
      res.status(200).json({
        success: true,
        message: "Rating added successfully.",
        prod,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      mess: error.message,
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
  postRating,
};
