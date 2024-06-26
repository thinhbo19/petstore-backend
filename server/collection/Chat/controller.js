const { default: mongoose } = require("mongoose");
const ChatModel = require("./model");
const UserModel = require("../Users/model");
const asyncHandler = require("express-async-handler");

const createChat = asyncHandler(async (req, res) => {
  const { secondId } = req.body;
  try {
    const adminAndCsdUsers = await UserModel.find({
      role: { $in: ["Admin", "CSD"] },
    }).select("_id");
    const adminAndCsdIds = adminAndCsdUsers.map((user) => user._id.toString());

    const chats = [];
    for (const firstId of adminAndCsdIds) {
      const existingChat = await ChatModel.findOne({
        members: { $all: [firstId, secondId] },
      });

      if (!existingChat) {
        const newChat = new ChatModel({
          members: [firstId, secondId],
        });
        const response = await newChat.save();
        chats.push(response);
      }
    }

    if (chats.length > 0) {
      return res.status(200).json(chats);
    } else {
      return res
        .status(400)
        .json({ message: "Chat already exists for all admins and CSDs" });
    }
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

const deleteChat = asyncHandler(async (req, res) => {
  const { _id } = req.params;
  try {
    const chat = await ChatModel.findByIdAndDelete(_id);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }
    return res.status(200).json({ message: "Chat deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = {
  createChat,
  findOneChat,
  findUserChat,
  findChat,
  deleteChat,
};
