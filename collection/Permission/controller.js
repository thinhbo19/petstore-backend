const asyncHandler = require("express-async-handler");
const RolePermission = require("./model");
const { getAllApiRoutes } = require("../../service/systemApiCollector");
const {
  DEFAULT_ROLES,
  normalizeRoleName,
  isValidRoleName,
  normalizePath,
} = require("../../service/permissionService");
const escapeRegex = (s = "") => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const getPagination = (query = {}) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(1000, Math.max(1, Number(query.limit) || 1000));
  return { page, limit, skip: (page - 1) * limit };
};

const getRoles = asyncHandler(async (_req, res) => {
  const dbRoles = await RolePermission.distinct("role");
  const roles = Array.from(
    new Set([...DEFAULT_ROLES, ...dbRoles.filter(Boolean).map((role) => String(role).trim())]),
  );

  return res.status(200).json({
    success: true,
    roles,
  });
});

const getPermissionsByRole = asyncHandler(async (req, res) => {
  const role = normalizeRoleName(req.params.role);
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const { page, limit, skip } = getPagination(req.query);
  if (!isValidRoleName(role)) {
    return res.status(400).json({
      success: false,
      message: "Role không hợp lệ",
    });
  }

  const roleDoc = await RolePermission.findOne({ role }).lean();
  let permissions = roleDoc?.permissions || [];
  if (q) {
    const regex = new RegExp(escapeRegex(q), "i");
    permissions = permissions.filter(
      (item) => regex.test(String(item.method || "")) || regex.test(String(item.path || "")),
    );
  }

  const total = permissions.length;
  const pagedPermissions = permissions.slice(skip, skip + limit);

  return res.status(200).json({
    success: true,
    role,
    data: pagedPermissions,
    permissions: pagedPermissions,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
});

const createRolePermission = asyncHandler(async (req, res) => {
  const role = normalizeRoleName(req.body?.role);
  if (!isValidRoleName(role)) {
    return res.status(400).json({
      success: false,
      message: "Role không hợp lệ. Chỉ dùng chữ, số, _ và - (2-30 ký tự)",
    });
  }

  const existed = await RolePermission.findOne({ role }).lean();
  if (existed) {
    return res.status(409).json({
      success: false,
      message: "Role đã tồn tại",
    });
  }

  await RolePermission.create({
    role,
    permissions: [],
    updatedBy: req.user?._id,
  });

  return res.status(201).json({
    success: true,
    message: "Tạo role phân quyền thành công",
    role,
    permissions: [],
  });
});

const updatePermissionsByRole = asyncHandler(async (req, res) => {
  const role = normalizeRoleName(req.params.role);
  if (!isValidRoleName(role)) {
    return res.status(400).json({
      success: false,
      message: "Role không hợp lệ",
    });
  }

  const inputPermissions = Array.isArray(req.body?.permissions) ? req.body.permissions : [];
  const sanitizedInput = inputPermissions
    .filter((item) => item && item.method && item.path)
    .map((item) => ({
      method: String(item.method).toUpperCase(),
      path: normalizePath(item.path),
      allowed: Boolean(item.allowed),
    }));

  const apiRoutes = getAllApiRoutes(req.app);
  const validApiKeys = new Set(
    apiRoutes.map(
      (item) => `${String(item.method).toUpperCase()}:${normalizePath(item.path)}`,
    ),
  );
  const filteredPermissions = sanitizedInput.filter((item) =>
    validApiKeys.has(`${item.method}:${item.path}`),
  );
  const dedupMap = new Map(
    filteredPermissions.map((item) => [`${item.method}:${item.path}`, item]),
  );
  const normalizedPermissions = Array.from(dedupMap.values()).filter(
    (item) => item.allowed,
  );

  const updated = await RolePermission.findOneAndUpdate(
    { role },
    {
      role,
      permissions: normalizedPermissions,
      updatedBy: req.user?._id,
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  return res.status(200).json({
    success: true,
    role,
    permissions: updated.permissions || [],
    message: "Cập nhật phân quyền thành công",
  });
});

const deleteRolePermission = asyncHandler(async (req, res) => {
  const role = normalizeRoleName(req.params.role);
  if (!isValidRoleName(role)) {
    return res.status(400).json({
      success: false,
      message: "Role không hợp lệ",
    });
  }

  if (DEFAULT_ROLES.includes(role)) {
    return res.status(400).json({
      success: false,
      message: "Không thể xóa quyền mặc định của hệ thống",
    });
  }

  const deleted = await RolePermission.findOneAndDelete({ role });
  if (!deleted) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy quyền để xóa",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Xóa quyền thành công",
    role,
  });
});

module.exports = {
  getRoles,
  createRolePermission,
  getPermissionsByRole,
  updatePermissionsByRole,
  deleteRolePermission,
};
