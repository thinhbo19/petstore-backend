const News = require("./model");
const asyncHandler = require("express-async-handler");

const createNews = asyncHandler(async (req, res) => {
  try {
    const { title, firstWord, content } = req.body;
    const existingNews = await News.findOne({ title });
    if (existingNews) {
      return res.status(400).json({ message: "Title already exists" });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    const image = req.files[0].path;
    const newNews = new News({
      title,
      firstWord,
      content,
      image,
    });
    await newNews.save();
    return res.status(201).json({ success: true, newNews });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const getAllNews = asyncHandler(async (req, res) => {
  try {
    const news = await News.find();
    return res.status(201).json({ success: true, news });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const getCurrentNews = asyncHandler(async (req, res) => {
  try {
    const { nid } = req.params;
    if (!nid) {
      return res
        .status(400)
        .json({ success: false, message: "News ID is required" });
    }

    const news = await News.findById(nid);
    if (!news) {
      return res
        .status(404)
        .json({ success: false, message: "News not found" });
    }

    return res.status(200).json({ success: true, news });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

const deleteNews = asyncHandler(async (req, res) => {
  try {
    const { nid } = req.params;
    const news = await News.findById(nid);
    if (!news) {
      return res
        .status(404)
        .json({ success: false, message: "News not found" });
    }
    await News.findByIdAndDelete(nid);
    return res
      .status(200)
      .json({ success: true, message: "Delete successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

const getCurrentNewsByName = asyncHandler(async (req, res) => {
  try {
    const { nName } = req.params;
    const regexName = new RegExp(nName, "i");

    const existing = await News.findOne({
      title: { $regex: regexName },
    }).select("-__v");

    if (!existing) {
      return res.status(404).json({ success: false, message: "Not Found!!!" });
    }
    return res.status(200).json({ success: true, news: existing });
  } catch (error) {
    return res.status(400).json({ success: false, message: "Lỗi." });
  }
});

const changeNews = asyncHandler(async (req, res) => {
  try {
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
      return res
        .status(404)
        .json({ success: false, message: "Can not find!!!" });
    }
    return res.status(200).json({
      success: true,
      message: update,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Error update.",
    });
  }
});

module.exports = {
  createNews,
  getAllNews,
  getCurrentNews,
  deleteNews,
  getCurrentNewsByName,
  changeNews,
};
