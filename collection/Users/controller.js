const User = require("./model");
const AuditLog = require("../AuditLog/model");
const asyncHandler = require("express-async-handler");
const {
  generateAccessToken,
  generateRefreshToken,
} = require("../../middlewares/jwt");
const jwt = require("jsonwebtoken");
const sendMail = require("../../utils/sendMail");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const {
  generateActivationEmail,
  generateForgotPasswordOtpEmail,
} = require("../../service/emailTemplateService");
const { ERROR_CODES } = require("../../utils/apiResponse");
const { HttpError } = require("../../utils/httpError");

const sameSitePolicy = process.env.NODE_ENV === "production" ? "none" : "lax";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const buildRefreshCookieOptions = (rememberMe = false) => ({
  httpOnly: true,
  sameSite: sameSitePolicy,
  secure: process.env.NODE_ENV === "production",
  maxAge: (rememberMe ? 5 : 1) * ONE_DAY_MS,
});
const buildCsrfCookieOptions = (rememberMe = false) => ({
  httpOnly: false,
  sameSite: sameSitePolicy,
  secure: process.env.NODE_ENV === "production",
  maxAge: (rememberMe ? 5 : 1) * ONE_DAY_MS,
});
const issueCsrfToken = (res, rememberMe = false) => {
  const csrfToken = crypto.randomBytes(24).toString("hex");
  res.cookie("csrfToken", csrfToken, buildCsrfCookieOptions(rememberMe));
  return csrfToken;
};

const buildUserData = (user) => ({
  _id: user._id,
  username: user.username,
  Avatar: user.Avatar,
  email: user.email,
  mobile: user.mobile,
  role: user.role,
  Address: user.Address,
  isBlocked: user.isBlocked,
  date: user.date,
  assignedStaff: user.assignedStaff,
});
const PASSWORD_REGEX_ADMIN = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{3,}$/;
const PASSWORD_REGEX_REGISTER = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
const buildOtpPayload = () => {
  const otp = generateOTP();
  const otpExpiry = new Date();
  otpExpiry.setMinutes(otpExpiry.getMinutes() + 5);
  return { code: otp, expiresAt: otpExpiry };
};
const sendActivationOtpEmail = async ({ email, username, otp, subject }) => {
  const html = generateActivationEmail(username, otp);
  await sendMail({
    email,
    subject,
    html,
    type: "activation",
  });
};

const getRedirectUrlByRole = (role) => {
  if (role === "Admin") return "/dashboard";
  if (role === "User") return "/";
  if (role === "Staff") return "/dashboard";
  return "/";
};

const getLeastBusyStaffId = async () => {
  const staffs = await User.find({ role: "Staff" }).select("_id");
  if (!staffs.length) return null;

  const staffIds = staffs.map((staff) => staff._id);
  const assignmentStats = await User.aggregate([
    {
      $match: {
        role: "User",
        assignedStaff: { $in: staffIds },
      },
    },
    {
      $group: {
        _id: "$assignedStaff",
        totalCustomers: { $sum: 1 },
      },
    },
  ]);

  const assignmentMap = assignmentStats.reduce((acc, item) => {
    acc[item._id.toString()] = item.totalCustomers;
    return acc;
  }, {});

  let selectedStaffId = staffs[0]._id;
  let minCustomers = assignmentMap[selectedStaffId.toString()] || 0;

  for (const staff of staffs) {
    const total = assignmentMap[staff._id.toString()] || 0;
    if (total < minCustomers) {
      minCustomers = total;
      selectedStaffId = staff._id;
    }
  }

  return selectedStaffId;
};

const countActiveAdmins = async () =>
  User.countDocuments({
    role: "Admin",
    isDeleted: { $ne: true },
  });

const createAuditLog = async (req, action, targetUser, details = {}) => {
  try {
    await AuditLog.create({
      actorId: req.user?._id,
      actorRole: req.user?.role || "Unknown",
      action,
      targetUserId: targetUser?._id,
      targetEmail: targetUser?.email,
      details,
    });
  } catch (error) {
    console.error("Failed to write audit log:", error.message);
  }
};
const createAccount = asyncHandler(async (req, res) => {
  const { email, password, username, mobile, role, isBlocked } = req.body;
  if (!email || !password || !username || !role) {
    throw new HttpError(400, "Missing inputs", ERROR_CODES.VALIDATION);
  }
  if (!PASSWORD_REGEX_ADMIN.test(password)) {
    throw new HttpError(
      400,
      "Password must be at least 3 characters long and include both letters and numbers",
      ERROR_CODES.VALIDATION,
    );
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new HttpError(
      400,
      "User with this email already exists",
      ERROR_CODES.VALIDATION,
    );
  }

  const assignedStaff = role === "User" ? await getLeastBusyStaffId() : null;
  const newUser = await User.create({
    email,
    password,
    username,
    isBlocked: typeof isBlocked === "boolean" ? isBlocked : false,
    role,
    mobile,
    assignedStaff,
  });

  await createAuditLog(req, "CREATE_USER", newUser, {
    createdRole: role,
    isBlocked: newUser.isBlocked,
  });
  return res.status(200).json({
    success: true,
    message: "Create account successful!",
  });
});

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const register = asyncHandler(async (req, res) => {
  const { email, password, username, mobile } = req.body;
  if (!email || !password || !username || !mobile) {
    throw new HttpError(400, "Missing inputs", ERROR_CODES.VALIDATION);
  }
  if (!PASSWORD_REGEX_REGISTER.test(password)) {
    throw new HttpError(
      400,
      "Password must be at least 8 characters long and include both letters and numbers",
      ERROR_CODES.VALIDATION,
    );
  }
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new HttpError(
      400,
      "User with this email already exists",
      ERROR_CODES.VALIDATION,
    );
  }

  const otpPayload = buildOtpPayload();
  const assignedStaff = await getLeastBusyStaffId();
  await User.create({
    email,
    password,
    username,
    mobile,
    isBlocked: true,
    assignedStaff,
    otp: otpPayload,
  });

  await sendActivationOtpEmail({
    email,
    username,
    otp: otpPayload.code,
    subject: "Activate Your Account - OTP Verification",
  });

  return res.status(200).json({
    success: true,
    message:
      "Registration successful. Please check your email for OTP verification!",
  });
});

const activateAccount = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    throw new HttpError(
      400,
      "Email and OTP are required",
      ERROR_CODES.VALIDATION,
    );
  }

  const user = await User.findOne({ email });

  if (!user) {
    throw new HttpError(404, "User not found", ERROR_CODES.NOT_FOUND);
  }

  if (!user.otp || !user.otp.code || !user.otp.expiresAt) {
    throw new HttpError(
      400,
      "No OTP found for this user",
      ERROR_CODES.VALIDATION,
    );
  }

  if (user.otp.code !== otp) {
    throw new HttpError(400, "Invalid OTP", ERROR_CODES.VALIDATION);
  }

  if (new Date() > user.otp.expiresAt) {
    throw new HttpError(400, "OTP has expired", ERROR_CODES.VALIDATION);
  }

  user.isBlocked = false;
  user.otp = undefined;
  await user.save();

  return res.status(200).json({
    success: true,
    message: "Account activated successfully!",
  });
});

const resendOTP = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new HttpError(400, "Email is required", ERROR_CODES.VALIDATION);
  }

  const user = await User.findOne({ email });

  if (!user) {
    throw new HttpError(404, "User not found", ERROR_CODES.NOT_FOUND);
  }

  if (!user.isBlocked) {
    throw new HttpError(
      400,
      "Account is already activated",
      ERROR_CODES.VALIDATION,
    );
  }

  const otpPayload = buildOtpPayload();
  user.otp = otpPayload;
  await user.save();

  await sendActivationOtpEmail({
    email,
    username: user.username,
    otp: otpPayload.code,
    subject: "New OTP for Account Activation",
  });

  return res.status(200).json({
    success: true,
    message: "New OTP has been sent to your email",
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password, rememberMe } = req.body;

  if (!email) {
    throw new HttpError(400, "Missing Email", ERROR_CODES.VALIDATION);
  }

  if (!password) {
    throw new HttpError(400, "Missing Password", ERROR_CODES.VALIDATION);
  }

  const user = await User.findOne({ email, isDeleted: { $ne: true } });
  if (!user) {
    throw new HttpError(400, "User not found", ERROR_CODES.VALIDATION);
  }
  if (user.isBlocked) {
    throw new HttpError(
      403,
      "Your account has been blocked.",
      ERROR_CODES.FORBIDDEN,
    );
  }

  const isPasswordCorrect = await user.isCorrectPassword(password);

  if (!isPasswordCorrect) {
    throw new HttpError(400, "Invalid Password", ERROR_CODES.VALIDATION);
  }

  const userData = buildUserData(user);
  const shouldRemember = Boolean(rememberMe);
  const accessToken = generateAccessToken(
    user._id,
    user.role,
    shouldRemember ? "5d" : "1d",
  );
  const newRefreshToken = generateRefreshToken(user._id, shouldRemember);

  await User.findByIdAndUpdate(
    user._id,
    { refreshToken: newRefreshToken },
    { new: true },
  );

  res.cookie(
    "refreshToken",
    newRefreshToken,
    buildRefreshCookieOptions(shouldRemember),
  );
  const csrfToken = issueCsrfToken(res, shouldRemember);
  const url = getRedirectUrlByRole(userData.role);

  return res.status(200).json({
    success: true,
    userData,
    accessToken,
    csrfToken,
    url,
  });
});

const logout = asyncHandler(async (req, res) => {
  const cookie = req.cookies;
  if (cookie?.refreshToken) {
    await User.findOneAndUpdate(
      { refreshToken: cookie.refreshToken },
      { refreshToken: "" },
      { new: true },
    );
  }
  res.clearCookie("refreshToken", {
    httpOnly: true,
    sameSite: sameSitePolicy,
    secure: process.env.NODE_ENV === "production",
  });
  res.clearCookie("csrfToken", {
    httpOnly: false,
    sameSite: sameSitePolicy,
    secure: process.env.NODE_ENV === "production",
  });
  return res.status(200).json({
    success: true,
    message: "Đăng xuất thành công",
  });
});
const getallAccount = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(
    Math.max(parseInt(req.query.limit, 10) || 10, 1),
    100,
  );
  const search = (req.query.search || "").trim();
  const role = req.query.role;
  const isBlocked = req.query.isBlocked;
  const includeDeleted = req.query.includeDeleted === "true";

  const query = {};

  if (!includeDeleted) {
    query.isDeleted = { $ne: true };
  }

  if (search) {
    query.$or = [
      { username: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { mobile: { $regex: search, $options: "i" } },
    ];
  }

  if (role) {
    query.role = role;
  }

  if (typeof isBlocked !== "undefined" && isBlocked !== "") {
    query.isBlocked = isBlocked === "true";
  }

  const total = await User.countDocuments(query);
  const users = await User.find(query)
    .select("-refreshToken -password")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  return res.status(200).json({
    success: true,
    users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});
const getOneUser = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const user = await User.findById(_id).select(
    "-refreshToken -password -role -createdAt -updatedAt -passwordChangeAt -passwordResetExpire -passwordResetToken",
  );
  if (!user || user.isDeleted) {
    throw new HttpError(404, "User not found", ERROR_CODES.NOT_FOUND);
  }
  return res.status(200).json({
    success: true,
    data: user,
    rs: user,
  });
});
const getUserMess = asyncHandler(async (req, res) => {
  const { _id } = req.query;
  if (!_id) {
    throw new HttpError(400, "UID không được truyền", ERROR_CODES.VALIDATION);
  }
  const user = await User.findById(_id).select(
    "-refreshToken -password -role",
  );
  if (!user || user.isDeleted) {
    throw new HttpError(404, "Không tìm thấy người dùng", ERROR_CODES.NOT_FOUND);
  }
  return res.status(200).json({
    success: true,
    message: user,
  });
});
const refreshAccessToken = asyncHandler(async (req, res) => {
  const cookie = req.cookies;

  if (!cookie || !cookie.refreshToken) {
    return res.status(401).json({
      success: false,
      message: "No refresh token in cookie",
    });
  }

  let decoded;
  try {
    decoded = jwt.verify(cookie.refreshToken, process.env.JWT_SECRET);
  } catch (_error) {
    return res.status(401).json({
      success: false,
      message: "Invalid refresh token",
    });
  }
  const response = await User.findOne({
    _id: decoded._id,
    refreshToken: cookie.refreshToken,
    isDeleted: { $ne: true },
  }).select("_id username Avatar email mobile role Address isBlocked date assignedStaff");

  if (!response) {
    return res.status(401).json({
      success: false,
      message: "Refresh token is not matched",
    });
  }

  const userData = buildUserData(response);
  const shouldRemember = Boolean(decoded.rememberMe);
  const newAccessToken = generateAccessToken(
    response._id,
    response.role,
    shouldRemember ? "5d" : "1d",
  );
  const csrfToken = issueCsrfToken(res, shouldRemember);

  return res.status(200).json({
    success: true,
    userData,
    newAccessToken,
    csrfToken,
    url: getRedirectUrlByRole(response.role),
  });
});
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Missing email!",
    });
  }
  const user = await User.findOne({ email, isDeleted: { $ne: true } });
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }
  const resetToken = user.createPasswordChangeToken();
  await user.save();
  const resetUrl = `${process.env.URL_CLIENT}/reset-password?token=${resetToken}`;
  const html = `Xin vui lòng click vào link dưới đây để thay đổi mật khẩu của bạn. Link này sẽ hết hạn sau 15 phút kể từ bây giờ. <a href="${resetUrl}">Click Here</a>`;
  const data = {
    email: email,
    html,
    type: "reset",
  };
  await sendMail(data);
  return res.status(200).json({
    success: true,
    message: "Please check your email!",
  });
});
const forgotPasswordOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Missing email!",
    });
  }
  const user = await User.findOne({ email, isDeleted: { $ne: true } });
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  const otp = generateOTP();
  user.passwordResetToken = crypto
    .createHash("sha256")
    .update(otp)
    .digest("hex");
  user.passwordResetExpire = Date.now() + 15 * 60 * 1000;
  await user.save();

  const html = generateForgotPasswordOtpEmail(user.username, otp);
  await sendMail({
    email,
    html,
    type: "reset",
  });

  return res.status(200).json({
    success: true,
    message: "OTP has been sent to your email",
  });
});

const verifyForgotPasswordOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({
      success: false,
      message: "Missing email or otp",
    });
  }

  const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
  const user = await User.findOne({
    email,
    passwordResetToken: hashedOtp,
    passwordResetExpire: { $gt: Date.now() },
    isDeleted: { $ne: true },
  });

  if (!user) {
    return res.status(400).json({
      success: false,
      message: "Invalid or expired OTP",
    });
  }

  return res.status(200).json({
    success: true,
    message: "OTP is valid",
  });
});

const resetPasswordByOtp = asyncHandler(async (req, res) => {
  const { email, otp, password } = req.body;
  if (!email || !otp || !password) {
    return res.status(400).json({
      success: false,
      message: "Missing input",
    });
  }

  const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
  const user = await User.findOne({
    email,
    passwordResetToken: hashedOtp,
    passwordResetExpire: { $gt: Date.now() },
    isDeleted: { $ne: true },
  });

  if (!user) {
    return res.status(400).json({
      success: false,
      message: "Invalid or expired OTP",
    });
  }

  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpire = undefined;
  user.passwordChangeAt = Date.now();
  await user.save();

  return res.status(200).json({
    success: true,
    message: "Password updated successfully",
  });
});
const resetPassword = asyncHandler(async (req, res) => {
  const { password, token } = req.body;
  if (!password || !token) {
    throw new HttpError(400, "Miss input!!", ERROR_CODES.VALIDATION);
  }
  const passwordResetToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
  const user = await User.findOne({
    passwordResetToken,
    passwordResetExpire: { $gt: Date.now() },
  });
  if (!user) {
    throw new HttpError(400, "Invalid reset token!!", ERROR_CODES.VALIDATION);
  }
  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordChangeAt = Date.now();
  user.passwordResetExpire = undefined;
  await user.save();
  return res.status(200).json({
    sucess: user ? true : false,
    mes: user ? "Update password" : "Something went wrong",
  });
});
const verifyResetToken = asyncHandler(async (req, res) => {
  const { token } = req.body;
  const passwordResetToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
  const user = await User.findOne({
    passwordResetToken,
    passwordResetExpire: { $gt: Date.now() },
  });
  return res.status(200).json({
    success: user ? true : false,
    message: user ? "Token is valid" : "Token is invalid",
  });
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const userId = req.user?._id;

  const user = await User.findById(userId);
  if (!user) {
    throw new HttpError(404, "User not found", ERROR_CODES.NOT_FOUND);
  }

  const isMatch = await user.isCorrectPassword(currentPassword);
  if (!isMatch) {
    throw new HttpError(
      400,
      "Current password is incorrect",
      ERROR_CODES.VALIDATION,
    );
  }

  if (newPassword !== confirmPassword) {
    throw new HttpError(400, "Passwords do not match", ERROR_CODES.VALIDATION);
  }

  user.password = newPassword;

  await user.save();

  return res
    .status(200)
    .json({ success: true, message: "Password updated successfully" });
});
const deleteUser = asyncHandler(async (req, res) => {
  const { uid } = req.params;
  const actorId = String(req.user?._id || "");
  if (!uid) {
    throw new HttpError(400, "Missing Id!!", ERROR_CODES.VALIDATION);
  }

  if (actorId === String(uid)) {
    throw new HttpError(
      400,
      "You cannot delete your own account",
      ERROR_CODES.VALIDATION,
    );
  }

  const user = await User.findById(uid);
  if (!user || user.isDeleted) {
    throw new HttpError(404, "User not found", ERROR_CODES.NOT_FOUND);
  }

  if (user.role === "Admin") {
    const adminCount = await countActiveAdmins();
    if (adminCount <= 1) {
      throw new HttpError(
        400,
        "Cannot delete the last active admin account",
        ERROR_CODES.VALIDATION,
      );
    }
  }

  user.isDeleted = true;
  user.deletedAt = new Date();
  user.isBlocked = true;
  user.refreshToken = "";
  await user.save();

  await createAuditLog(req, "SOFT_DELETE_USER", user, {
    deletedAt: user.deletedAt,
  });

  return res.status(200).json({
    success: true,
    message: `User with email ${user.email} has been archived`,
  });
});
const updateUserByUser = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  if (!_id) {
    throw new HttpError(400, "Missing user ID", ERROR_CODES.VALIDATION);
  }

  let updateData = req.body;
  if (req.file && req.file.path) {
    updateData.Avatar = req.file.path;
  }

  const user = await User.findByIdAndUpdate(_id, updateData, {
    new: true,
  }).select("-password -role");
  if (!user) {
    throw new HttpError(404, "User not found", ERROR_CODES.NOT_FOUND);
  }

  return res.status(200).json({ success: true, data: user, updateUser: user });
});
const blockAccount = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const actorId = String(req.user?._id || "");
  if (!userId) {
    throw new HttpError(400, "Missing user ID", ERROR_CODES.VALIDATION);
  }

  if (actorId === String(userId) && req.body?.isBlocked === true) {
    throw new HttpError(
      400,
      "You cannot block your own account",
      ERROR_CODES.VALIDATION,
    );
  }

  let updateData = req.body;
  if (req.file && req.file.path) {
    updateData.Avatar = req.file.path;
  }

  const targetUser = await User.findById(userId);
  if (!targetUser || targetUser.isDeleted) {
    throw new HttpError(404, "User not found", ERROR_CODES.NOT_FOUND);
  }

  if (targetUser.role === "Admin" && updateData?.isBlocked === true) {
    const adminCount = await countActiveAdmins();
    if (adminCount <= 1) {
      throw new HttpError(
        400,
        "Cannot block the last active admin account",
        ERROR_CODES.VALIDATION,
      );
    }
  }

  const user = await User.findByIdAndUpdate(userId, updateData, {
    new: true,
  }).select("-password -refreshToken");
  if (!user) {
    throw new HttpError(404, "User not found", ERROR_CODES.NOT_FOUND);
  }

  await createAuditLog(req, "UPDATE_USER", user, {
    changedFields: Object.keys(updateData || {}),
  });

  return res.status(200).json({ success: true, data: user, updateUser: user });
});
const changeRole = asyncHandler(async (req, res) => {
  const { userId, newRole } = req.body;
  const actorId = String(req.user?._id || "");

  if (actorId === String(userId)) {
    throw new HttpError(
      400,
      "You cannot change your own role",
      ERROR_CODES.VALIDATION,
    );
  }

  const user = await User.findById(userId);
  if (!user || user.isDeleted) {
    throw new HttpError(404, "User not found!!", ERROR_CODES.NOT_FOUND);
  }
  const validRoles = ["Admin", "User", "Staff"];
  if (!validRoles.includes(newRole)) {
    throw new HttpError(400, "Invalid role", ERROR_CODES.VALIDATION);
  }

  if (user.role === "Admin" && newRole !== "Admin") {
    const adminCount = await countActiveAdmins();
    if (adminCount <= 1) {
      throw new HttpError(
        400,
        "Cannot change role of the last active admin",
        ERROR_CODES.VALIDATION,
      );
    }
  }

  const previousRole = user.role;
  user.role = newRole;
  const updatedUser = await user.save();

  await createAuditLog(req, "CHANGE_ROLE", updatedUser, {
    from: previousRole,
    to: newRole,
  });

  return res.status(200).json({
    success: true,
    message: "Change role successfully",
    user: updatedUser,
  });
});
module.exports = {
  createAccount,
  register,
  activateAccount,
  resendOTP,
  login,
  logout,
  getallAccount,
  getOneUser,
  getUserMess,
  refreshAccessToken,
  forgotPassword,
  forgotPasswordOtp,
  verifyForgotPasswordOtp,
  resetPasswordByOtp,
  resetPassword,
  verifyResetToken,
  deleteUser,
  updateUserByUser,
  blockAccount,
  changeRole,
  changePassword,
};
