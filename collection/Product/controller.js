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

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

    let filter = {};
    if (q) {
      const regex = new RegExp(escapeRegex(q), "i");
      filter = {
        $or: [
          { nameProduct: regex },
          { shortTitle: regex },
          { description: regex },
          { "category.nameCate": regex },
        ],
      };
    }

    const product = await Product.find(filter).sort({ nameProduct: 1 });
    return res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    throw new Error(error);
  }
});

/**
 * Admin: tìm phụ kiện theo tên, shortTitle, mô tả, tên danh mục.
 * GET /admin/search?q=
 */
const searchProductsForAdmin = asyncHandler(async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

    if (!q) {
      const product = await Product.find().sort({ nameProduct: 1 });
      return res.status(200).json({
        success: true,
        product,
      });
    }

    const regex = new RegExp(escapeRegex(q), "i");
    const product = await Product.find({
      $or: [
        { nameProduct: regex },
        { shortTitle: regex },
        { description: regex },
        { "category.nameCate": regex },
      ],
    }).sort({ nameProduct: 1 });

    return res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Lỗi tìm kiếm.",
    });
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

const getNextData = asyncHandler(async (req, res) => {
  try {
    const { pid } = req.params;

    const products = await Product.find().sort({ createdAt: 1 });

    if (!products.length) {
      return res
        .status(404)
        .json({ success: false, message: "Không có sản phẩm nào" });
    }

    const index = products.findIndex((p) => p._id.toString() === pid);

    if (index === -1) {
      return res
        .status(404)
        .json({
          success: false,
          message: "Không tìm thấy sản phẩm với id này",
        });
    }

    const nextIndex = (index + 1) % products.length;
    const nextProduct = products[nextIndex];

    return res.status(200).json({ success: true, product: nextProduct });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

const changeProduct = asyncHandler(async (req, res) => {
  try {
    const { productId } = req.params;
    const { nameProduct, quantity, price, description } = req.body;
    if (!productId) throw new Error("Missing Id!!");

    const existing = await Product.findById(productId);
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Can not find!!!" });
    }

    const qtyProvided =
      quantity !== undefined && quantity !== null && quantity !== "";
    const parsedQty = qtyProvided ? Number(quantity) : Number(existing.quantity);
    const safeQty = Number.isFinite(parsedQty)
      ? Math.max(0, Math.floor(parsedQty))
      : 0;

    const update = await Product.findByIdAndUpdate(
      productId,
      {
        nameProduct,
        ...(qtyProvided ? { quantity: safeQty } : {}),
        price,
        description,
        sold: safeQty > 0 ? false : true,
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
    const { star, comment } = req.body;
    const postBy = req.user?._id;

    const newFiles = (req.files || []).map((file) => file.path);

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
    let feedback_img = newFiles;
    if (existingRatingIndex !== -1 && newFiles.length === 0) {
      const prev = prod.rating[existingRatingIndex].feedback_img || [];
      feedback_img = Array.isArray(prev) ? [...prev] : [];
    }
    if (existingRatingIndex !== -1) {
      prod.rating[existingRatingIndex] = {
        postBy,
        username: user.username,
        avatar: user.Avatar,
        star,
        comment,
        dateComment: Date.now(),
        feedback_img,
      };
    } else {
      prod.rating.push({
        postBy,
        username: user.username,
        avatar: user.Avatar,
        star,
        comment,
        dateComment: Date.now(),
        feedback_img,
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
      message: error.message || "Lỗi máy chủ",
    });
  }
});

module.exports = {
  createProduct,
  getAllProduct,
  searchProductsForAdmin,
  changeProduct,
  deleteProduct,
  getCurrentProduct,
  getCurrentProductByName,
  findProductsByCategory,
  postRating,
  getNextData,
};
