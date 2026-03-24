const asyncHandler = require("express-async-handler");
const AuditLog = require("./model");

const getAuditLogs = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const search = (req.query.search || "").trim();
  const action = (req.query.action || "").trim();

  const query = {};

  if (search) {
    query.$or = [
      { targetEmail: { $regex: search, $options: "i" } },
      { action: { $regex: search, $options: "i" } },
      { actorRole: { $regex: search, $options: "i" } },
    ];
  }

  if (action) {
    query.action = action;
  }

  const total = await AuditLog.countDocuments(query);
  const logs = await AuditLog.find(query)
    .populate("actorId", "username email role")
    .populate("targetUserId", "username email role")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  return res.status(200).json({
    success: true,
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

module.exports = {
  getAuditLogs,
};
