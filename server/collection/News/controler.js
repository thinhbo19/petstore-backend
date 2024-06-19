const News = require("./model");
const asyncHandler = require("express-async-handler");

const createNews = asyncHandler(async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    const image = req.files[0].path;
    const newNews = new News({
      title,
      content,
      image,
    });
    await newNews.save();
    return res.status(201).json({ success: true, newNews });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
module.exports = {
  createNews,
};
