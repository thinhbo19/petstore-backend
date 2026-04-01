const Category = require("./model");
const asyncHandler = require("express-async-handler");
const {
  escapeRegex,
  getPagination,
  getSort,
  getFields,
} = require("../../utils/queryHelpers");

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

const getAllCate = asyncHandler(async (req, res) => {
  try {
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
  } catch (error) {
    throw new Error(error);
  }
});

const deleteCate = asyncHandler(async (req, res) => {
  try {
    const { cateId } = req.params;
    if (!cateId) throw new Error("Missing Id!!");

    const category = await Category.findByIdAndDelete(cateId);
    return res.status(200).json({
      success: category ? true : false,
      delete: category ? `Sucessfully` : "No category is deleted",
    });
  } catch (error) {
    throw new Error(error);
  }
});

const changeCate = asyncHandler(async (req, res) => {
  try {
    const { cateId } = req.params;
    const { nameCategory } = req.body;
    if (!cateId) throw new Error("Missing Id!!");

    const updateName = await Category.findByIdAndUpdate(
      cateId,
      { nameCategory },
      { new: true }
    );
    if (!updateName) {
      return res
        .status(404)
        .json({ success: false, message: "Can not find!!!" });
    }
    return res.status(200).json({
      success: true,
      message: updateName,
    });
  } catch (error) {
    throw new Error(error);
  }
});

const getCurrentCate = asyncHandler(async (req, res) => {
  try {
    const { cid } = req.params;
    const existingCate = await Category.findById(cid);
    if (!existingCate) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy!!!" });
    }
    return res.status(200).json({ success: true, category: existingCate });
  } catch (error) {
    return res.status(400).json({ success: false, message: "Lỗi." });
  }
});

module.exports = {
  createCategory,
  getAllCate,
  deleteCate,
  changeCate,
  getCurrentCate,
};
