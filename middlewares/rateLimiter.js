const rateLimit = require("express-rate-limit");

const buildAuthLimiter = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message,
    },
  });

const loginLimiter = buildAuthLimiter(
  15 * 60 * 1000,
  10,
  "Too many login attempts. Please try again later.",
);

const registerLimiter = buildAuthLimiter(
  60 * 60 * 1000,
  20,
  "Too many register attempts. Please try again later.",
);

const otpLimiter = buildAuthLimiter(
  10 * 60 * 1000,
  10,
  "Too many OTP requests. Please try again later.",
);

const resetPasswordLimiter = buildAuthLimiter(
  15 * 60 * 1000,
  20,
  "Too many password reset requests. Please try again later.",
);

module.exports = {
  loginLimiter,
  registerLimiter,
  otpLimiter,
  resetPasswordLimiter,
};
