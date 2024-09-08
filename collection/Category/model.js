const mongoose = require("mongoose");

var categorySchema = new mongoose.Schema({
  nameCategory: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
});

module.exports = mongoose.model("Category", categorySchema);
