const RolePermission = require("../collection/Permission/model");

const DEFAULT_ROLES = ["Admin", "User", "Staff"];
const ALL_DASHBOARD_MENUS = [
  "dashboard",
  "products-dogs",
  "products-cats",
  "products-accessories",
  "services-grooming",
  "users",
  "permissions-api",
  "permissions-roles",
  "permissions-menu",
  "vouchers",
  "orders",
  "audit",
  "news",
  "settings",
  "customer-service",
];
const ROLE_NAME_REGEX = /^[A-Za-z][A-Za-z0-9_-]{1,29}$/;

const normalizePath = (path = "") => {
  if (!path) return "/";
  const clean = String(path).split("?")[0].replace(/\/+/g, "/");
  if (clean.length > 1 && clean.endsWith("/")) return clean.slice(0, -1);
  return clean.startsWith("/") ? clean : `/${clean}`;
};

const isPathMatch = (permissionPath, requestPath) => {
  const p = normalizePath(permissionPath).split("/").filter(Boolean);
  const r = normalizePath(requestPath).split("/").filter(Boolean);
  if (p.length !== r.length) return false;

  for (let i = 0; i < p.length; i += 1) {
    if (p[i].startsWith(":")) continue;
    if (p[i] !== r[i]) return false;
  }
  return true;
};

/** Không phụ thuộc bản ghi Permission trong DB (route mới thường chưa được admin bật). Controller đã kiểm tra chủ đơn. */
const INTRINSIC_USER_ONLY_ROUTES = [
  {
    method: "PATCH",
    path: "/api/order/user/confirm-received/:orderID",
  },
  {
    method: "PATCH",
    path: "/api/order/user/cancel/:orderID",
  },
  {
    method: "POST",
    path: "/api/pets/rating/:petId",
  },
  {
    method: "POST",
    path: "/api/product/rating/:prodId",
  },
];

const toPermissionKey = (method, path) => `${String(method).toUpperCase()}:${normalizePath(path)}`;

const normalizeRoleName = (role = "") => {
  const value = String(role || "").trim();
  if (!value) return "";
  const lower = value.toLowerCase();
  if (lower === "admin") return "Admin";
  if (lower === "user") return "User";
  if (lower === "staff") return "Staff";
  return value;
};

const isValidRoleName = (role = "") => ROLE_NAME_REGEX.test(String(role || "").trim());

const buildDefaultPermissions = (apiRoutes) =>
  apiRoutes.map((route) => ({
    method: route.method.toUpperCase(),
    path: normalizePath(route.path),
    allowed: true,
  }));

const syncRolePermissions = async (role, apiRoutes) => {
  const roleDoc = await RolePermission.findOne({ role });
  const existingMap = new Map(
    (roleDoc?.permissions || []).map((item) => [
      toPermissionKey(item.method, item.path),
      {
        method: String(item.method).toUpperCase(),
        path: normalizePath(item.path),
        allowed: Boolean(item.allowed),
      },
    ]),
  );

  const nextPermissions = buildDefaultPermissions(apiRoutes).map((item) => {
    const existing = existingMap.get(toPermissionKey(item.method, item.path));
    return existing || item;
  });

  const saved = await RolePermission.findOneAndUpdate(
    { role },
    {
      role,
      permissions: nextPermissions,
      dashboardAccess:
        roleDoc?.dashboardAccess != null ? roleDoc.dashboardAccess : role === "Admin",
      dashboardMenus:
        Array.isArray(roleDoc?.dashboardMenus) && roleDoc.dashboardMenus.length
          ? roleDoc.dashboardMenus
          : role === "Admin"
            ? ALL_DASHBOARD_MENUS
            : [],
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  return saved;
};

const ensureAllRolesPermissionDocs = async (apiRoutes) => {
  await Promise.all(DEFAULT_ROLES.map((role) => syncRolePermissions(role, apiRoutes)));
};

const isApiAllowedByRole = async (role, method, requestPath) => {
  if (!role) return false;
  if (String(role).toLowerCase() === "admin") return true;
  const normalizedMethod = String(method || "").toUpperCase();
  const normalizedRequestPath = normalizePath(requestPath);

  if (normalizeRoleName(role) === "User") {
    const intrinsic = INTRINSIC_USER_ONLY_ROUTES.some(
      (rule) =>
        String(rule.method).toUpperCase() === normalizedMethod &&
        isPathMatch(rule.path, normalizedRequestPath),
    );
    if (intrinsic) return true;
  }

  const roleDoc = await RolePermission.findOne({ role }).lean();
  if (!roleDoc) return true;

  const matched = (roleDoc.permissions || []).find(
    (item) =>
      String(item.method || "").toUpperCase() === normalizedMethod &&
      isPathMatch(item.path, normalizedRequestPath),
  );

  if (!matched) return false;
  return Boolean(matched.allowed);
};

module.exports = {
  DEFAULT_ROLES,
  normalizeRoleName,
  isValidRoleName,
  normalizePath,
  ensureAllRolesPermissionDocs,
  syncRolePermissions,
  isApiAllowedByRole,
  ALL_DASHBOARD_MENUS,
};
