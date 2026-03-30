const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    data: { type: Object, required: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Settings", settingsSchema);
