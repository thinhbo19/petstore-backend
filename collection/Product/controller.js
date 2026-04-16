const { default: mongoose } = require("mongoose");
const asyncHandler = require("express-async-handler");
const Product = require("./model");
const Category = require("../Category/model.js");
const User = require("../Users/model");
const {
  escapeRegex,
  getPagination,
  getSort,
  getFields,
} = require("../../utils/queryHelpers");
const { ERROR_CODES } = require("../../utils/apiResponse");
const { HttpError } = require("../../utils/httpError");

const formatString = (input) => {
  const words = input.split("-");
  const formattedWords = words.map(
    (word) => word.charAt(0).toUpperCase() + word.slice(1)
  );

  return formattedWords.join(" ");
};

const ADMIN_SEARCH_CACHE_TTL_MS = 15000;
const adminSearchCache = new Map();
const getCachedAdminSearch = (key) => {
  const hit = adminSearchCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expireAt) {
    adminSearchCache.delete(key);
    return null;
  }
  return hit.value;
};
const setCachedAdminSearch = (key, value) => {
  adminSearchCache.set(key, {
    value,
    expireAt: Date.now() + ADMIN_SEARCH_CACHE_TTL_MS,
  });
};

const createProduct = asyncHandler(async (req, res) => {
  const { nameProduct, category, shortTitle, quantity, price, description } =
    req.body;
  if (!req.files?.length) {
    throw new HttpError(400, "Vui lòng tải ít nhất một ảnh.", ERROR_CODES.VALIDATION);
  }
  const images = req.files.map((file) => file.path);

  if (!mongoose.Types.ObjectId.isValid(category)) {
    throw new HttpError(400, "Mã danh mục không hợp lệ.", ERROR_CODES.VALIDATION);
  }

  const existingCate = await Category.findById(category);
  if (!existingCate) {
    throw new HttpError(
      404,
      "Không tìm thấy danh mục với mã đã nhập.",
      ERROR_CODES.NOT_FOUND
    );
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

  return res.status(200).json({
    success: true,
    message: "Add product successfully",
    newProduct,
  });
});

const getAllProduct = asyncHandler(async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const { page, limit, skip } = getPagination(req.query);
  const sort = getSort(req.query, ["nameProduct", "price", "createdAt"], "nameProduct");
  const select = getFields(req.query, [
    "_id",
    "nameProduct",
    "shortTitle",
    "category",
    "quantity",
    "price",
    "description",
    "images",
    "sold",
    "createdAt",
    "updatedAt",
  ]);

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

  const [product, total] = await Promise.all([
    Product.find(filter).select(select).sort(sort).skip(skip).limit(limit),
    Product.countDocuments(filter),
  ]);
  return res.status(200).json({
    success: true,
    data: product,
    product,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
});

/**
 * Admin: tìm phụ kiện theo tên, shortTitle, mô tả, tên danh mục.
 * GET /admin/search?q=
 */
const searchProductsForAdmin = asyncHandler(async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const { page, limit, skip } = getPagination(req.query);
  const sort = getSort(req.query, ["nameProduct", "price", "createdAt"], "nameProduct");
  const select = getFields(req.query, [
    "_id",
    "nameProduct",
    "shortTitle",
    "category",
    "quantity",
    "price",
    "description",
    "images",
    "sold",
    "createdAt",
    "updatedAt",
  ]);
  const cacheKey = JSON.stringify({
    q,
    page,
    limit,
    sort: req.query.sort || "",
    fields: req.query.fields || "",
  });
  const cached = getCachedAdminSearch(cacheKey);
  if (cached) {
    return res.status(200).json(cached);
  }
  const regex = q ? new RegExp(escapeRegex(q), "i") : null;
  const filter = q
    ? {
        $or: [
          { nameProduct: regex },
          { shortTitle: regex },
          { description: regex },
          { "category.nameCate": regex },
        ],
      }
    : {};
  const [product, total] = await Promise.all([
    Product.find(filter).select(select).sort(sort).skip(skip).limit(limit),
    Product.countDocuments(filter),
  ]);

  const payload = {
    success: true,
    data: product,
    product,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
  setCachedAdminSearch(cacheKey, payload);
  return res.status(200).json(payload);
});

const getCurrentProduct = asyncHandler(async (req, res) => {
  const { prodid } = req.params;
  const existing = await Product.findById(prodid);
  if (!existing) {
    throw new HttpError(
      404,
      "Không tìm thấy sản phẩm.",
      ERROR_CODES.NOT_FOUND
    );
  }
  return res.status(200).json({
    success: true,
    existing,
  });
});

const getNextData = asyncHandler(async (req, res) => {
  const { pid } = req.params;

  const products = await Product.find().sort({ createdAt: 1 });

  if (!products.length) {
    throw new HttpError(
      404,
      "Không có sản phẩm nào.",
      ERROR_CODES.NOT_FOUND
    );
  }

  const index = products.findIndex((p) => p._id.toString() === pid);

  if (index === -1) {
    throw new HttpError(
      404,
      "Không tìm thấy sản phẩm với id này.",
      ERROR_CODES.NOT_FOUND
    );
  }

  const nextIndex = (index + 1) % products.length;
  const nextProduct = products[nextIndex];

  return res.status(200).json({ success: true, product: nextProduct });
});

const changeProduct = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { nameProduct, quantity, price, description } = req.body;
  if (!productId) {
    throw new HttpError(400, "Thiếu mã sản phẩm.", ERROR_CODES.VALIDATION);
  }

  const existing = await Product.findById(productId);
  if (!existing) {
    throw new HttpError(404, "Không tìm thấy sản phẩm.", ERROR_CODES.NOT_FOUND);
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
    throw new HttpError(404, "Không tìm thấy sản phẩm.", ERROR_CODES.NOT_FOUND);
  }
  return res.status(200).json({
    success: true,
    message: update,
  });
});

const deleteProduct = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  if (!productId) {
    throw new HttpError(400, "Thiếu mã sản phẩm.", ERROR_CODES.VALIDATION);
  }

  const product = await Product.findByIdAndDelete(productId);
  return res.status(200).json({
    success: product ? true : false,
    delete: product ? "Successfully" : "No product is deleted",
  });
});

const getCurrentProductByName = asyncHandler(async (req, res) => {
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
    throw new HttpError(
      404,
      "Không tìm thấy sản phẩm.",
      ERROR_CODES.NOT_FOUND
    );
  }
  return res.status(200).json({ success: true, data: existingProd, prod: existingProd });
});

const findProductsByCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const products = await Product.find({ "category.categoryID": id });

  if (products.length > 0) {
    return res.status(200).json({
      success: true,
      message: `Found ${products.length} products in category: ${id}`,
      data: products,
      products,
    });
  }
  throw new HttpError(
    404,
    `Không có sản phẩm trong danh mục: ${id}`,
    ERROR_CODES.NOT_FOUND
  );
});
const postRating = asyncHandler(async (req, res) => {
  const { star, comment } = req.body;
  const postBy = req.user?._id;

  const newFiles = (req.files || []).map((file) => file.path);

  const { prodId } = req.params;

  const prod = await Product.findById(prodId);
  const user = await User.findById(postBy);

  if (!prod) {
    throw new HttpError(404, "Không tìm thấy sản phẩm.", ERROR_CODES.NOT_FOUND);
  }
  if (!user) {
    throw new HttpError(404, "Không tìm thấy người dùng.", ERROR_CODES.NOT_FOUND);
  }
  if (
    !postBy ||
    star == null ||
    comment === undefined ||
    comment === null ||
    !String(comment).trim()
  ) {
    throw new HttpError(
      400,
      "Vui lòng nhập đủ: sao, nội dung đánh giá.",
      ERROR_CODES.VALIDATION
    );
  }

  if (star < 1 || star > 5) {
    throw new HttpError(
      400,
      "Số sao phải từ 1 đến 5.",
      ERROR_CODES.VALIDATION
    );
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
    return res.status(200).json({
      success: true,
      message: "Rating updated successfully.",
      prod,
    });
  }
  return res.status(200).json({
    success: true,
    message: "Rating added successfully.",
    prod,
  });
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
