const mongoose = require("mongoose");

var brandSchema = new mongoose.Schema({
  nameBrand: {
    type: String,
    required: true,
  },
});

module.exports = mongoose.model("Brand", brandSchema);
