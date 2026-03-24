const mongoose = require("mongoose");

const systemApiNoteSchema = new mongoose.Schema(
  {
    method: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    path: {
      type: String,
      required: true,
      trim: true,
    },
    note: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    updatedBy: {
      type: mongoose.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

systemApiNoteSchema.index({ method: 1, path: 1 }, { unique: true });

module.exports = mongoose.model("SystemApiNote", systemApiNoteSchema);
