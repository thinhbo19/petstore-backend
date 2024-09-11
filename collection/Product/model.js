const mongoose = require("mongoose"); // Erase if already required

// Declare the Schema of the Mongo model
var productSchema = new mongoose.Schema({
  nameProduct: {
    type: String,
    required: true,
  },
  shortTitle: { type: String },
  category: {
    categoryID: { type: mongoose.Schema.ObjectId, ref: "Brand", require: true },
    nameCate: { type: String },
  },
  quantity: { type: Number },
  price: { type: Number },
  description: { type: String },
  images: { type: Array },
  rating: [
    {
      postBy: { type: mongoose.Schema.ObjectId, ref: "User", require: true },
      username: { type: String },
      start: { type: Number },
      comment: { type: String },
      dateComment: { type: Date, default: Date.now() },
      feedback_img: { type: String },
    },
  ],
});

//Export the model
module.exports = mongoose.model("Product", productSchema);
