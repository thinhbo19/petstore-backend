/**
 * Chuẩn hóa JSON lỗi API: luôn có success: false và message (string).
 * Optional: code (mã ổn định cho client), errors (chi tiết validation).
 */
const ERROR_CODES = {
  INTERNAL: "INTERNAL_ERROR",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
};

const sendError = (res, statusCode, message, options = {}) => {
  const { code, errors } = options;
  const body = {
    success: false,
    message: message || "Đã có lỗi xảy ra",
  };
  if (code) body.code = code;
  if (errors !== undefined) body.errors = errors;
  return res.status(statusCode).json(body);
};

const sendSuccess = (res, statusCode, payload = {}) => {
  return res.status(statusCode).json({ success: true, ...payload });
};

module.exports = {
  sendError,
  sendSuccess,
  ERROR_CODES,
};
