const mongoose = require("mongoose");

var typeServiceSchema = new mongoose.Schema({
  nameService: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  description: { type: String },
  price: { type: Number },
});

module.exports = mongoose.model("TypeService", typeServiceSchema);
