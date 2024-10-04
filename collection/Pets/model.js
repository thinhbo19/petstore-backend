const mongoose = require("mongoose");

var PetSchema = new mongoose.Schema({
  namePet: {
    type: String,
    required: true,
    unique: true,
  },
  imgPet: {
    type: Array,
  },
  petBreed: {
    breedID: { type: mongoose.Types.ObjectId, ref: "PetBreed", required: true },
    nameBreed: { type: String },
    nameSpecies: { type: String },
  },
  age: { type: Number },
  gender: { type: String, enum: ["Male", "Female", "Castrated"] },
  description: { type: String },
  price: { type: Number },
  quantity: { type: Number },
  deworming: { type: Number },
  vaccination: { type: Number },
  characteristic: { type: String },
  sold: {
    type: Boolean,
    default: false,
  },
  rating: [
    {
      postBy: { type: mongoose.Schema.ObjectId, ref: "User", require: true },
      username: { type: String },
      avatar: { type: String },
      star: { type: Number, required: true, min: 1, max: 5 },
      comment: { type: String },
      dateComment: { type: Date, default: Date.now() },
      feedback_img: { type: [String] },
    },
  ],
});
module.exports = mongoose.model("Pets", PetSchema);
