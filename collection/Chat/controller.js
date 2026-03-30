const ChatModel = require("./model");
const UserModel = require("../Users/model");
const MessModel = require("../Messager/model");
const asyncHandler = require("express-async-handler");
const { normalizeId, hasMember, getIdCandidates } = require("../../utils/idUtils");

const getLeastBusyStaffId = async () => {
  const staffs = await UserModel.find({ role: "Staff" }).select("_id");
  if (!staffs.length) return null;

  const staffIds = staffs.map((staff) => staff._id);
  const assignmentStats = await UserModel.aggregate([
    {
      $match: {
        role: "User",
        assignedStaff: { $in: staffIds },
      },
    },
    {
      $group: {
        _id: "$assignedStaff",
        totalCustomers: { $sum: 1 },
      },
    },
  ]);

  const assignmentMap = assignmentStats.reduce((acc, item) => {
    acc[item._id.toString()] = item.totalCustomers;
    return acc;
  }, {});

  let selectedStaffId = staffs[0]._id;
  let minCustomers = assignmentMap[selectedStaffId.toString()] || 0;

  for (const staff of staffs) {
    const total = assignmentMap[staff._id.toString()] || 0;
    if (total < minCustomers) {
      minCustomers = total;
      selectedStaffId = staff._id;
    }
  }

  return selectedStaffId;
};

const ensureAssignedStaff = async (customer) => {
  if (customer.assignedStaff) return customer.assignedStaff.toString();
  const staffId = await getLeastBusyStaffId();
  if (!staffId) return null;
  customer.assignedStaff = staffId;
  await customer.save();
  return staffId.toString();
};

const getOrCreateOneToOneChat = async (firstId, secondId) => {
  const firstCandidates = getIdCandidates(firstId);
  const secondCandidates = getIdCandidates(secondId);
  const candidates = [...firstCandidates, ...secondCandidates];
  const possibleChats = await ChatModel.find({
    members: { $in: candidates },
  });
  let chat = possibleChats.find((item) => {
    const members = (item.members || []).map((memberId) => normalizeId(memberId));
    return (
      members.length === 2 &&
      members.includes(normalizeId(firstId)) &&
      members.includes(normalizeId(secondId))
    );
  });
  if (!chat) {
    chat = await ChatModel.create({
      members: [firstId, secondId],
    });
  }
  return chat;
};

const createChat = asyncHandler(async (req, res) => {
  try {
    if (req.user.role !== "Admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin can backfill chats",
      });
    }

    const users = await UserModel.find({ role: "User" });
    const upsertedChats = [];

    for (const user of users) {
      const staffId = await ensureAssignedStaff(user);
      if (!staffId) continue;
      const chat = await getOrCreateOneToOneChat(user._id.toString(), staffId);
      upsertedChats.push(chat);
    }

    return res.status(200).json({
      success: true,
      total: upsertedChats.length,
      chats: upsertedChats,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

const findOneChat = asyncHandler(async (req, res) => {
  const { _id } = req.params;
  try {
    const chat = await ChatModel.findById(_id);
    if (!chat) {
      return res.status(404).json({ success: false, message: "Chat not found" });
    }
    if (!hasMember(chat.members, req.user._id)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    return res.status(200).json({ success: true, chat });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

const findUserChat = asyncHandler(async (req, res) => {
  try {
    const userId = normalizeId(req.params.userId);
    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: "Missing userId parameter" });
    }

    if (
      req.user.role !== "Admin" &&
      normalizeId(req.user._id) !== normalizeId(userId)
    ) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: you can only read your own conversations",
      });
    }

    const idCandidates = getIdCandidates(userId);
    const chats = await ChatModel.find({
      members: { $in: idCandidates },
    });
    return res.status(200).json({ success: true, chats });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

const findChat = asyncHandler(async (req, res) => {
  const firstId = req.params.firstId;
  const { secondId } = req.params;
  try {
    if (!firstId || !secondId) {
      return res.status(400).json({
        success: false,
        message: "firstId and secondId are required",
      });
    }

    if (
      req.user.role !== "Admin" &&
      normalizeId(req.user._id) !== normalizeId(firstId) &&
      normalizeId(req.user._id) !== normalizeId(secondId)
    ) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const firstCandidates = getIdCandidates(firstId);
    const secondCandidates = getIdCandidates(secondId);
    const possibleChats = await ChatModel.find({
      members: { $in: [...firstCandidates, ...secondCandidates] },
    });
    const chat =
      possibleChats.find((item) => {
        const members = (item.members || []).map((memberId) =>
          normalizeId(memberId),
        );
        return (
          members.length === 2 &&
          members.includes(normalizeId(firstId)) &&
          members.includes(normalizeId(secondId))
        );
      }) || null;
    return res.status(200).json({ success: true, chat });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

const getMyChat = asyncHandler(async (req, res) => {
  try {
    if (req.user.role !== "User") {
      return res.status(403).json({
        success: false,
        message: "Only customer accounts can use this endpoint",
      });
    }

    const customer = await UserModel.findById(req.user._id).populate(
      "assignedStaff",
      "_id username Avatar email role",
    );
    if (!customer) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const staffId = await ensureAssignedStaff(customer);
    if (!staffId) {
      return res.status(400).json({
        success: false,
        message: "No staff available for customer service",
      });
    }

    const chat = await getOrCreateOneToOneChat(customer._id.toString(), staffId);
    const freshCustomer = await UserModel.findById(customer._id).populate(
      "assignedStaff",
      "_id username Avatar email role",
    );

    return res.status(200).json({
      success: true,
      chat,
      assignedStaff: freshCustomer?.assignedStaff || null,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

const getStaffConversations = asyncHandler(async (req, res) => {
  try {
    if (req.user.role !== "Staff") {
      return res.status(403).json({
        success: false,
        message: "Only staff can access staff conversations",
      });
    }

    const staffId = req.user._id.toString();
    const assignedCustomers = await UserModel.find({
      role: "User",
      assignedStaff: staffId,
    }).select("_id username Avatar email mobile");

    const customerMap = new Map();
    for (const customer of assignedCustomers) {
      customerMap.set(normalizeId(customer._id), customer);
    }

    const existingChats = await ChatModel.find({
      members: { $in: getIdCandidates(staffId) },
    });
    const otherMemberIds = existingChats
      .map((chat) => {
        const members = (chat.members || []).map((memberId) =>
          normalizeId(memberId),
        );
        if (!members.includes(staffId) || members.length !== 2) return null;
        return members.find((memberId) => memberId !== staffId) || null;
      })
      .filter(Boolean);

    if (otherMemberIds.length) {
      const legacyCustomers = await UserModel.find({
        _id: { $in: otherMemberIds },
        role: "User",
      }).select("_id username Avatar email mobile");

      for (const customer of legacyCustomers) {
        customerMap.set(normalizeId(customer._id), customer);
      }
    }

    const customers = Array.from(customerMap.values());
    const conversations = [];
    for (const customer of customers) {
      const chat = await getOrCreateOneToOneChat(
        customer._id.toString(),
        staffId,
      );
      const lastMessage = await MessModel.findOne({ chatId: chat._id.toString() })
        .sort({ createdAt: -1 })
        .select("_id senderId text image createdAt");

      conversations.push({
        chatId: chat._id,
        customer,
        members: chat.members,
        updatedAt: chat.updatedAt,
        lastMessage,
      });
    }

    conversations.sort((a, b) => {
      const dateA = a.lastMessage?.createdAt || a.updatedAt;
      const dateB = b.lastMessage?.createdAt || b.updatedAt;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

    return res.status(200).json({
      success: true,
      conversations,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

const deleteChat = asyncHandler(async (req, res) => {
  const { _id } = req.params;
  try {
    if (req.user.role !== "Admin") {
      return res
        .status(403)
        .json({ success: false, message: "Only admin can delete chats" });
    }
    const chat = await ChatModel.findByIdAndDelete(_id);
    if (!chat) {
      return res.status(404).json({ success: false, message: "Chat not found" });
    }
    return res
      .status(200)
      .json({ success: true, message: "Chat deleted successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = {
  createChat,
  findOneChat,
  findUserChat,
  findChat,
  getMyChat,
  getStaffConversations,
  deleteChat,
};
