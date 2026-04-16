const Category = require("./model");
const asyncHandler = require("express-async-handler");
const {
  escapeRegex,
  getPagination,
  getSort,
  getFields,
} = require("../../utils/queryHelpers");
const { HttpError } = require("../../utils/httpError");
const { ERROR_CODES } = require("../../utils/apiResponse");

const createCategory = asyncHandler(async (req, res) => {
  const { nameCategory } = req.body;
  const newCate = new Category({ nameCategory });
  await newCate.save();
  return res.status(200).json({ success: true, data: newCate, newCate });
});

const getAllCate = asyncHandler(async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const { page, limit, skip } = getPagination(req.query);
  const sort = getSort(req.query, ["nameCategory", "createdAt", "updatedAt"], "nameCategory");
  const select = getFields(req.query, ["_id", "nameCategory", "createdAt", "updatedAt"]);
  const filter = q
    ? { nameCategory: { $regex: new RegExp(escapeRegex(q), "i") } }
    : {};
  const [category, total] = await Promise.all([
    Category.find(filter).select(select).sort(sort).skip(skip).limit(limit),
    Category.countDocuments(filter),
  ]);
  return res.status(200).json({
    success: true,
    data: category,
    category,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
});

const deleteCate = asyncHandler(async (req, res) => {
  const { cateId } = req.params;
  if (!cateId) {
    throw new HttpError(400, "Missing Id!!", ERROR_CODES.VALIDATION);
  }

  const category = await Category.findByIdAndDelete(cateId);
  return res.status(200).json({
    success: Boolean(category),
    delete: category ? "Successfully" : "No category is deleted",
  });
});

const changeCate = asyncHandler(async (req, res) => {
  const { cateId } = req.params;
  const { nameCategory } = req.body;
  if (!cateId) {
    throw new HttpError(400, "Missing Id!!", ERROR_CODES.VALIDATION);
  }

  const updateName = await Category.findByIdAndUpdate(
    cateId,
    { nameCategory },
    { new: true }
  );
  if (!updateName) {
    throw new HttpError(404, "Can not find!!!", ERROR_CODES.NOT_FOUND);
  }
  return res.status(200).json({
    success: true,
    data: updateName,
    message: "Category updated successfully",
  });
});

const getCurrentCate = asyncHandler(async (req, res) => {
  const { cid } = req.params;
  const existingCate = await Category.findById(cid);
  if (!existingCate) {
    throw new HttpError(404, "Không tìm thấy!!!", ERROR_CODES.NOT_FOUND);
  }
  return res.status(200).json({ success: true, data: existingCate, category: existingCate });
});

module.exports = {
  createCategory,
  getAllCate,
  deleteCate,
  changeCate,
  getCurrentCate,
};
