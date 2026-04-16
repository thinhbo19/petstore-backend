/**
 * Lỗi HTTP có statusCode (và optional code ổn định cho client).
 * Dùng với asyncHandler: throw new HttpError(404, "...", ERROR_CODES.NOT_FOUND)
 */
class HttpError extends Error {
  /**
   * @param {number} statusCode - HTTP status
   * @param {string} message - Thông báo cho client (tiếng Việt/Anh tùy route)
   * @param {string} [code] - Một trong ERROR_CODES hoặc undefined
   */
  constructor(statusCode, message, code) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    if (code) this.code = code;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

module.exports = { HttpError };
