const { default: mongoose } = require("mongoose");
const ChatModel = require("./model");
const asyncHandler = require("express-async-handler");

const createChat = asyncHandler(async (req, res) => {
  const { firstId, secondId } = req.body;
  try {
    const chat = await ChatModel.findOne({
      members: { $all: [firstId, secondId] },
    });

    if (chat) return res.status(200).json(chat);

    const newChat = new ChatModel({
      members: [firstId, secondId],
    });

    const response = await newChat.save();
    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});
const findOneChat = asyncHandler(async (req, res) => {
  const { _id } = req.params;
  try {
    const chats = await ChatModel.find({ _id });
    return res.status(200).json(chats);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

const findUserChat = asyncHandler(async (req, res) => {
  const userId = req.params.userId;
  try {
    const chats = await ChatModel.find({
      members: { $in: [userId] },
    });
    return res.status(200).json(chats);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

const findChat = asyncHandler(async (req, res) => {
  const { firstId, secondId } = req.params;
  try {
    const chat = await ChatModel.findOne({
      members: { $in: [firstId, secondId] },
    });
    return res.status(200).json(chat);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = {
  createChat,
  findOneChat,
  findUserChat,
  findChat,
};
