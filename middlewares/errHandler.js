const { sendError, ERROR_CODES } = require("../utils/apiResponse");

const notFound = (req, res, next) => {
  const error = new Error(`Route ${req.originalUrl} not found`);
  res.status(404);
  next(error);
};

const resolveStatusCode = (error, res) => {
  if (typeof error?.statusCode === "number") {
    return error.statusCode;
  }
  if (res.statusCode && res.statusCode !== 200) {
    return res.statusCode;
  }
  return 500;
};

const resolveErrorCode = (statusCode, error) => {
  if (error?.code && typeof error.code === "string") {
    return error.code;
  }
  if (statusCode === 404) return ERROR_CODES.NOT_FOUND;
  if (statusCode === 401) return ERROR_CODES.UNAUTHORIZED;
  if (statusCode === 403) return ERROR_CODES.FORBIDDEN;
  if (statusCode >= 500) return ERROR_CODES.INTERNAL;
  if (statusCode >= 400 && statusCode < 500) return ERROR_CODES.VALIDATION;
  return undefined;
};

const errHandle = (error, req, res, next) => {
  const statusCode = resolveStatusCode(error, res);
  const isProd = process.env.NODE_ENV === "production";

  console.error("[HTTP Error]", {
    statusCode,
    method: req.method,
    path: req.originalUrl,
    message: error?.message,
    stack: error?.stack,
  });

  const clientMessage =
    statusCode >= 500 && isProd
      ? "Lỗi máy chủ. Vui lòng thử lại sau."
      : error?.message || "Đã có lỗi xảy ra";

  const code = resolveErrorCode(statusCode, error);

  return sendError(res, statusCode, clientMessage, { code });
};

module.exports = {
  notFound,
  errHandle,
};
