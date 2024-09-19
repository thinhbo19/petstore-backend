const mongoose = require("mongoose");

var bookingSchema = new mongoose.Schema({
  user: {
    userID: { type: mongoose.Types.ObjectId, ref: "User", require: true },
    username: { type: String },
    mobile: { type: String },
    email: { type: String },
    Avatar: { type: String, default: "" },
  },
  pet: {
    namePet: { type: String },
    imgPet: { type: Array },
    nameBreed: { type: String },
    age: { type: Number },
    gender: { type: String },
    deworming: { type: Number },
    vaccination: { type: Number },
  },
  services: [
    {
      serviceID: {
        type: mongoose.Schema.ObjectId,
        ref: "TypeService",
        require: true,
      },
      nameService: { type: String },
      description: { type: String },
      price: { type: Number },
    },
  ],
  bookingDate: { type: Date },
  totalPrice: { type: Number },
  status: { type: String, enum: ["Processing", "Completed", "Cancelled"] },
});

module.exports = mongoose.model("Booking", bookingSchema);
