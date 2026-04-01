const mongoose = require("mongoose"); // Erase if already required

var newsSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      unique: true,
    },
    firstWord: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    image: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);
newsSchema.index({ firstWord: 1 });

module.exports = mongoose.model("News", newsSchema);
