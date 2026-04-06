const User = require("./model");

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const getUserByIdOrThrow = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw createHttpError(404, "User not found");
  return user;
};

const sendUserServerError = (
  res,
  message,
  { includeSuccess = true, logLabel, error } = {},
) => {
  if (logLabel) {
    console.error(`${logLabel}:`, error);
  }
  if (includeSuccess) {
    return res.status(500).json({ success: false, message });
  }
  return res.status(500).json({ message });
};

const parseAddressIndex = (value) => {
  const idx = Number.parseInt(value, 10);
  return Number.isInteger(idx) ? idx : -1;
};

const ensureAddressIndexOrThrow = (user, addressIndex) => {
  const idx = parseAddressIndex(addressIndex);
  if (idx < 0 || idx >= user.Address.length) {
    throw createHttpError(400, "Invalid address index");
  }
  return idx;
};

module.exports = {
  createHttpError,
  getUserByIdOrThrow,
  sendUserServerError,
  ensureAddressIndexOrThrow,
};
