const News = require("./model");
const asyncHandler = require("express-async-handler");
const slugify = require("slugify");
const {
  escapeRegex,
  getPagination,
  getSort,
  getFields,
} = require("../../utils/queryHelpers");
const {
  buildCacheKey,
  getCache,
  setCache,
  invalidateNamespace,
} = require("../../utils/cacheStore");
const { HttpError } = require("../../utils/httpError");
const { ERROR_CODES } = require("../../utils/apiResponse");

const createNews = asyncHandler(async (req, res) => {
  const { title, firstWord, content } = req.body;
  const existingNews = await News.findOne({ title });
  if (existingNews) {
    throw new HttpError(400, "Title already exists", ERROR_CODES.VALIDATION);
  }

  if (!req.files || req.files.length === 0) {
    throw new HttpError(400, "No file uploaded", ERROR_CODES.VALIDATION);
  }
  const image = req.files[0].path;
  const newNews = new News({
    title,
    firstWord,
    content,
    image,
  });
  await newNews.save();
  await invalidateNamespace("news:list");
  return res.status(201).json({ success: true, data: newNews, newNews });
});

const getAllNews = asyncHandler(async (req, res) => {
  const cacheKey = buildCacheKey("news:list", JSON.stringify(req.query || {}));
  const cached = await getCache(cacheKey);
  if (cached) {
    return res.status(200).json(cached);
  }

  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const { page, limit, skip } = getPagination(req.query);
  const sort = getSort(
    req.query,
    ["title", "createdAt", "updatedAt"],
    { createdAt: -1 },
  );
  const select = getFields(req.query, [
    "_id",
    "title",
    "firstWord",
    "content",
    "image",
    "createdAt",
    "updatedAt",
  ]);
  const filter = q
    ? {
        $or: [
          { title: { $regex: new RegExp(escapeRegex(q), "i") } },
          { firstWord: { $regex: new RegExp(escapeRegex(q), "i") } },
          { content: { $regex: new RegExp(escapeRegex(q), "i") } },
        ],
      }
    : {};

  const [news, total] = await Promise.all([
    News.find(filter).select(select).sort(sort).skip(skip).limit(limit),
    News.countDocuments(filter),
  ]);
  const payload = {
    success: true,
    data: news,
    news,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
  await setCache(cacheKey, payload, 90);
  return res.status(200).json(payload);
});

const getCurrentNews = asyncHandler(async (req, res) => {
  const { nid } = req.params;
  if (!nid) {
    throw new HttpError(400, "News ID is required", ERROR_CODES.VALIDATION);
  }

  const news = await News.findById(nid);
  if (!news) {
    throw new HttpError(404, "News not found", ERROR_CODES.NOT_FOUND);
  }

  return res.status(200).json({ success: true, data: news, news });
});

const deleteNews = asyncHandler(async (req, res) => {
  const { nid } = req.params;
  const news = await News.findById(nid);
  if (!news) {
    throw new HttpError(404, "News not found", ERROR_CODES.NOT_FOUND);
  }
  await News.findByIdAndDelete(nid);
  await invalidateNamespace("news:list");
  return res
    .status(200)
    .json({ success: true, message: "Delete successfully" });
});

const getCurrentNewsByName = asyncHandler(async (req, res) => {
  const { nName } = req.params;

  const allNews = await News.find().select("-__v");

  const existing = allNews.find(
    (article) => slugify(article.title) === nName
  );

  if (!existing) {
    throw new HttpError(
      404,
      "Bài viết không được tìm thấy.",
      ERROR_CODES.NOT_FOUND
    );
  }

  return res.status(200).json({ success: true, data: existing, news: existing });
});

const changeNews = asyncHandler(async (req, res) => {
  const { nid } = req.params;
  const { title, firstWord, content } = req.body;
  let image;

  if (req.files && req.files.length > 0) {
    image = req.files[0].path;
  }

  const updateData = {
    title,
    firstWord,
    content,
    image,
  };

  const update = await News.findByIdAndUpdate(nid, updateData, { new: true });

  if (!update) {
    throw new HttpError(404, "Can not find!!!", ERROR_CODES.NOT_FOUND);
  }
  await invalidateNamespace("news:list");
  return res.status(200).json({
    success: true,
    data: update,
    message: "News updated successfully",
  });
});

module.exports = {
  createNews,
  getAllNews,
  getCurrentNews,
  deleteNews,
  getCurrentNewsByName,
  changeNews,
};
