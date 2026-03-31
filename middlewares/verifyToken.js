const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const { isApiAllowedByRole } = require("../service/permissionService");
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const verifyAccessToken = asyncHandler(async (req, res, next) => {
  const authorizationHeader = req.headers.authorization;

  if (!authorizationHeader || !authorizationHeader.startsWith("Bearer")) {
    return res.status(401).json({
      success: false,
      message: "Missing or invalid authorization header",
    });
  }

  const token = authorizationHeader.split(" ")[1];
  let decoded;

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token has expired",
      });
    }
    return res.status(401).json({
      success: false,
      message: "Invalid access token",
    });
  }

  req.user = decoded;
  const requestPath = `${req.baseUrl || ""}${req.path || ""}`;

  if (!SAFE_METHODS.has(String(req.method).toUpperCase())) {
    const csrfFromCookie = req.cookies?.csrfToken;
    const csrfFromHeader = req.headers["x-csrf-token"];
    if (!csrfFromCookie || !csrfFromHeader || csrfFromCookie !== csrfFromHeader) {
      return res.status(403).json({
        success: false,
        message: "Invalid CSRF token",
      });
    }
  }

  if (req.user?.role === "Admin" && requestPath.startsWith("/api/permission")) {
    return next();
  }
  if (requestPath === "/api/permission/dashboard-access/me") {
    return next();
  }

  const isAllowed = await isApiAllowedByRole(
    req.user?.role,
    req.method,
    requestPath,
  );

  if (!isAllowed) {
    return res.status(403).json({
      success: false,
      message: "Bạn không có quyền truy cập API này",
    });
  }

  next();
});
const isAdmin = asyncHandler(async (req, res, next) => {
  const { role } = req.user;
  if (role !== "Admin" && role !== "Staff")
    return res.status(403).json({
      success: false,
      message: "Chỉ Admin hoặc Staff được phép thực hiện thao tác này",
    });
  next();
});

const isStrictAdmin = asyncHandler(async (req, res, next) => {
  const { role } = req.user;
  if (role !== "Admin") {
    return res.status(403).json({
      success: false,
      message: "Only Admin is allowed to perform this action",
    });
  }
  next();
});

module.exports = {
  verifyAccessToken,
  isAdmin,
  isStrictAdmin,
};
