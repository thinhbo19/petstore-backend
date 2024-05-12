const mongoose = require("mongoose");

var brandSchema = new mongoose.Schema({
  nameBrand: {
    type: String,
    required: true,
  },
  category: {
    cateID: { type: mongoose.Schema.ObjectId, ref: "Category", require: true },
    nameCate: { type: String },
  },
});

module.exports = mongoose.model("Brand", brandSchema);
