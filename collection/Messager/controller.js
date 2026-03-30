const MessModel = require("./model");
const ChatModel = require("../Chat/model");
const UserModel = require("../Users/model");
const asyncHandler = require("express-async-handler");
const { normalizeId, hasMember, getIdCandidates } = require("../../utils/idUtils");
const getPairChats = async (chat) => {
  const members = (chat.members || []).map((memberId) => normalizeId(memberId));
  if (members.length !== 2) return [chat];
  const [firstId, secondId] = members;
  const possibleChats = await ChatModel.find({
    members: { $in: [...getIdCandidates(firstId), ...getIdCandidates(secondId)] },
  }).sort({ createdAt: 1 });

  return possibleChats.filter((item) => {
    const itemMembers = (item.members || []).map((memberId) => normalizeId(memberId));
    return (
      itemMembers.length === 2 &&
      itemMembers.includes(firstId) &&
      itemMembers.includes(secondId)
    );
  });
};
const THREE_DAYS_IN_MS = 3 * 24 * 60 * 60 * 1000;
const findCustomerIdFromChat = async (chat) => {
  const memberIds = (chat.members || [])
    .map((memberId) => normalizeId(memberId))
    .filter(Boolean);
  if (!memberIds.length) return "";

  const users = await UserModel.find({
    _id: { $in: memberIds },
    role: "User",
  })
    .select("_id")
    .lean();
  if (!users.length) return "";
  return normalizeId(users[0]._id);
};
const purgeMessagesIfCustomerInactive = async (pairChatIds, customerId) => {
  if (!pairChatIds.length || !customerId) return false;

  const lastCustomerMessage = await MessModel.findOne({
    chatId: { $in: pairChatIds },
    senderId: customerId,
  })
    .sort({ createdAt: -1 })
    .select("_id createdAt");

  if (!lastCustomerMessage) return false;

  const inactiveMs = Date.now() - new Date(lastCustomerMessage.createdAt).getTime();
  if (inactiveMs < THREE_DAYS_IN_MS) return false;

  await MessModel.deleteMany({ chatId: { $in: pairChatIds } });
  return true;
};

const createMess = asyncHandler(async (req, res) => {
  try {
    const { chatId, text } = req.body;
    const senderId = req.user._id;
    const normalizedText = (text || "").trim();
    const image = req.file?.path || req.body?.image || "";

    if (!chatId || (!normalizedText && !image)) {
      return res.status(400).json({
        success: false,
        message: "chatId and at least text or image are required",
      });
    }

    const chat = await ChatModel.findById(chatId);
    if (!chat) {
      return res.status(404).json({ success: false, message: "Chat not found" });
    }

    if (!hasMember(chat.members, senderId)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const pairChats = await getPairChats(chat);
    const pairChatIds = pairChats.map((item) => normalizeId(item._id));
    const canonicalChatId = normalizeId((pairChats[0] || chat)._id);
    const customerId = await findCustomerIdFromChat(chat);
    const wasPurged = await purgeMessagesIfCustomerInactive(pairChatIds, customerId);

    const message = new MessModel({
      chatId: canonicalChatId,
      senderId,
      text: normalizedText,
      image,
    });

    const response = await message.save();
    return res.status(200).json({
      success: true,
      message: response,
      wasPurged,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

const getMess = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  try {
    const chat = await ChatModel.findById(chatId);
    if (!chat) {
      return res.status(404).json({ success: false, message: "Chat not found" });
    }

    if (!hasMember(chat.members, req.user._id)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const pairChats = await getPairChats(chat);
    const pairChatIds = pairChats.map((item) => normalizeId(item._id));
    const customerId = await findCustomerIdFromChat(chat);
    const wasPurged = await purgeMessagesIfCustomerInactive(pairChatIds, customerId);
    const parsedLimit = parseInt(req.query.limit, 10);
    const limit =
      Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, 100)
        : 30;
    const before = req.query.before;
    const query = {
      chatId: { $in: pairChatIds },
    };

    if (before) {
      const beforeDate = new Date(before);
      if (!Number.isNaN(beforeDate.getTime())) {
        query.createdAt = { $lt: beforeDate };
      }
    }

    const rawMessages = await MessModel.find(query)
      .sort({ createdAt: -1 })
      .limit(limit);
    const messages = rawMessages.reverse();
    const hasMore = rawMessages.length === limit;
    const nextCursor = hasMore && messages.length > 0 ? messages[0].createdAt : null;

    return res.status(200).json({
      success: true,
      messages,
      chatIds: pairChatIds,
      wasPurged,
      pagination: {
        limit,
        hasMore,
        nextCursor,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = {
  createMess,
  getMess,
};
