const { default: mongoose } = require("mongoose");
const MessModel = require("./model");
const asyncHandler = require("express-async-handler");

const createMess = asyncHandler(async (req, res) => {
  const { chatId, senderId, text } = req.body;
  const message = new MessModel({
    chatId,
    senderId,
    text,
  });

  try {
    const response = await message.save();
    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

const getMess = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  try {
    const messages = await MessModel.find({ chatId });
    return res.status(200).json(messages);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = {
  createMess,
  getMess,
};
