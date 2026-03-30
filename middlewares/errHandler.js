const { sendError, ERROR_CODES } = require("../utils/apiResponse");

const notFound = (req, res, next) => {
  const error = new Error(`Route ${req.originalUrl} not found`);
  res.status(404);
  next(error);
};

const errHandle = (error, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
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

  const code =
    statusCode === 404
      ? ERROR_CODES.NOT_FOUND
      : statusCode >= 500
        ? ERROR_CODES.INTERNAL
        : undefined;

  return sendError(res, statusCode, clientMessage, { code });
};

module.exports = {
  notFound,
  errHandle,
};
