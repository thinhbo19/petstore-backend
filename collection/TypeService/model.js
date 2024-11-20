const mongoose = require("mongoose");

var typeServiceSchema = new mongoose.Schema({
  nameService: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  type: { type: String },
  description: { type: String },
  price: { type: Number },
  rating: [
    {
      postBy: { type: mongoose.Schema.ObjectId, ref: "User", require: true },
      username: { type: String },
      avatar: { type: String },
      star: { type: Number, required: true, min: 1, max: 5 },
      comment: { type: String },
      dateComment: { type: Date, default: Date.now() },
      feedback_img: { type: Array },
    },
  ],
});

module.exports = mongoose.model("TypeService", typeServiceSchema);
