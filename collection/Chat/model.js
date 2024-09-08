const mongoose = require("mongoose");
var chatSchema = new mongoose.Schema(
  {
    members: {
      type: Array,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Chat", chatSchema);
