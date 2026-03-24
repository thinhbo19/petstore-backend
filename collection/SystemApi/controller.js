const asyncHandler = require("express-async-handler");
const { getAllApiRoutes } = require("../../service/systemApiCollector");
const SystemApiNote = require("./model");

const normalizePath = (path = "") => {
  const clean = String(path || "").split("?")[0].replace(/\/+/g, "/");
  if (!clean) return "/";
  if (clean.length > 1 && clean.endsWith("/")) return clean.slice(0, -1);
  return clean.startsWith("/") ? clean : `/${clean}`;
};

const getApiNote = (method, path) => {
  const parts = String(path || "").split("/").filter(Boolean);
  const moduleName = parts[1] || "core";
  const methodText = String(method || "").toUpperCase();

  const moduleLabelMap = {
    user: "người dùng",
    chat: "chat",
    mess: "tin nhắn",
    pets: "thú cưng",
    petspecies: "loài thú cưng",
    petbreed: "giống thú cưng",
    cate: "danh mục",
    product: "sản phẩm",
    news: "bài viết",
    typeservice: "dịch vụ",
    booking: "đặt lịch",
    order: "đơn hàng",
    voucher: "voucher",
    systemapi: "danh mục API",
    permission: "phân quyền",
    audit: "audit log",
  };

  const label = moduleLabelMap[moduleName.toLowerCase()] || moduleName;
  if (methodText === "GET") return `Lấy dữ liệu ${label}`;
  if (methodText === "POST") return `Tạo mới ${label}`;
  if (methodText === "PUT") return `Cập nhật ${label}`;
  if (methodText === "PATCH") return `Chỉnh sửa một phần ${label}`;
  if (methodText === "DELETE") return `Xóa ${label}`;
  return `Thao tác với ${label}`;
};

const getAllSystemApis = asyncHandler(async (req, res) => {
  const notes = await SystemApiNote.find({}).lean();
  const noteMap = new Map(
    notes.map((item) => [
      `${String(item.method).toUpperCase()}:${normalizePath(item.path)}`,
      item.note,
    ]),
  );

  const routes = getAllApiRoutes(req.app).map((item) => {
    const method = String(item.method).toUpperCase();
    const path = normalizePath(item.path);
    const customNote = noteMap.get(`${method}:${path}`);

    return {
      method,
      path,
      note: customNote || getApiNote(method, path),
      fullUrl: `${req.protocol}://${req.get("host")}${path}`,
    };
  });

  return res.status(200).json({
    success: true,
    total: routes.length,
    apis: routes,
  });
});

const updateSystemApiNote = asyncHandler(async (req, res) => {
  const method = String(req.body?.method || "")
    .trim()
    .toUpperCase();
  const path = normalizePath(req.body?.path || "");
  const note = String(req.body?.note || "").trim();

  if (!method || !path || !note) {
    return res.status(400).json({
      success: false,
      message: "method, path, note là bắt buộc",
    });
  }

  const existingRoute = getAllApiRoutes(req.app).find(
    (item) => String(item.method).toUpperCase() === method && normalizePath(item.path) === path,
  );
  if (!existingRoute) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy API tương ứng",
    });
  }

  const updated = await SystemApiNote.findOneAndUpdate(
    { method, path },
    {
      method,
      path,
      note,
      updatedBy: req.user?._id,
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  return res.status(200).json({
    success: true,
    message: "Cập nhật note API thành công",
    data: {
      method: updated.method,
      path: updated.path,
      note: updated.note,
      updatedAt: updated.updatedAt,
    },
  });
});

module.exports = {
  getAllSystemApis,
  updateSystemApiNote,
};
