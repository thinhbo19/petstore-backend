const User = require("../models/user");
const asyncHandler = require("express-async-handler");
const {
  generateAccessToken,
  generateRefreshToken,
} = require("../middlewares/jwt");
const jwt = require("jsonwebtoken");
const sendMail = require("../ultils/sendMail");
const crypto = require("crypto");

const register = asyncHandler(async (req, res) => {
  const { email, password, username, mobile } = req.body;
  if (!email || !password || !username || !mobile) {
    return res.status(400).json({
      success: false,
      message: "Missing inputs",
    });
  }

  const existingUser = await User.findOne({ email });
  const existingUserMobile = await User.findOne({ mobile });

  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: "User with this email already exists",
    });
  } else if (existingUserMobile) {
    return res.status(400).json({
      success: false,
      message: "User with this mobile already exists",
    });
  } else {
    const newUser = await User.create(req.body);
    if (newUser) {
      return res.status(200).json({
        success: true,
        message: "Registration successful. Please proceed to login.",
      });
    } else {
      return res.status(500).json({
        success: false,
        message: "Something went wrong during registration.",
      });
    }
  }
});
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      mess: "Missing Input",
    });
  }
  const response = await User.findOne({ email });
  if (response && (await response.isCorrectPassword(password))) {
    const { password, refreshToken, ...userData } = response.toObject();
    const accessToken = generateAccessToken(response._id, response.role);
    const newRefreshToken = generateRefreshToken(response._id);
    await User.findByIdAndUpdate(
      response._id,
      { refreshToken: newRefreshToken },
      { new: true }
    );
    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60,
    });
    return res.status(200).json({
      success: true,
      userData,
      accessToken,
    });
  } else {
    throw new Error("Invalid credentials!");
  }
});
const logout = asyncHandler(async (req, res) => {
  const cookie = req.cookies;
  if (!cookie || !cookie.refreshToken)
    throw new Error("You are not logged in!!");
  await User.findOneAndUpdate(
    { refreshToken: cookie.refreshToken },
    { refreshToken: "" },
    { new: true }
  );
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: true,
  });
  return res.status(200).json({
    success: true,
    mess: "You are logged out!!!",
  });
});
const getallAccount = asyncHandler(async (req, res) => {
  try {
    const user = await User.find().select("-refreshToken -password -role");
    return res.status(200).json({
      success: true,
      users: user,
    });
  } catch (error) {
    throw new Error(error);
  }
});
const getOneUser = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const user = await User.findById(_id).select("-refreshToken -password -role");
  return res.status(200).json({
    success: user ? true : false,
    rs: user ? user : "User not found",
  });
});
const refreshAccessToken = asyncHandler(async (req, res) => {
  const cookie = req.cookies;

  if (!cookie && !cookie.refreshToken)
    throw new Error("No refresh token in cookie");

  const rs = await jwt.verify(cookie.refreshToken, process.env.JWT_SECRET);
  const response = await User.findOne({
    _id: rs._id,
    refreshToken: cookie.refreshToken,
  });
  return res.status(200).json({
    success: response ? true : false,
    newAccessToken: response
      ? generateAccessToken(response._id, response.role)
      : "Refresh token is not matched",
  });
});
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.query;
  if (!email) {
    throw new Error("Missing email");
  }
  const user = await User.findOne({ email });
  if (!user) {
    throw new Error("User not found");
  }
  const resetToken = user.createPasswordChangeToken();
  await user.save();
  const resetUrl = `${process.env.URL_SERVER}/api/user/reset-password/${resetToken}`;
  const html = `Xin vui lòng click vào link dưới đây để thay đổi mật khẩu của bạn. Link này sẽ hết hạn sau 15 phút kể từ bây giờ. <a href="${resetUrl}">Click Here</a>`;
  const data = {
    email: email,
    html,
  };
  const sendMailResponse = await sendMail(data);
  return res.status(200).json({
    success: true,
    message: "Password reset email sent",
    sendMailResponse: sendMailResponse,
  });
});
const resetPassword = asyncHandler(async (req, res) => {
  const { password, token } = req.body;
  if (!password || !token) throw new Error("Miss input!!");
  const passwordResetToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
  const user = await User.findOne({
    passwordResetToken,
    passwordResetExpire: { $gt: Date.now() },
  });
  if (!user) throw new Error("Invalid reset token!!");
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
const deleteUser = asyncHandler(async (req, res) => {
  try {
    const { _id } = req.query;
    if (!_id) throw new Error("Missing Id!!");
    const user = await User.findByIdAndDelete(_id);
    return res.status(200).json({
      success: user ? true : false,
      deleteUser: user
        ? `User with email ${user.email} has been deleted`
        : "No user is deleted",
    });
  } catch (error) {
    throw new Error(error);
  }
});
const updateUserByUser = asyncHandler(async (req, res) => {
  try {
    const { _id } = req.user;
    if (!_id || Object.keys(req.body).length === 0)
      throw new Error("Missing Id!!");
    const user = await User.findByIdAndUpdate(_id, req.body, {
      new: true,
    }).select("-password -role");
    return res.status(200).json({
      success: user ? true : false,
      updateUser: user ? user : "Something went wrong!!",
    });
  } catch (error) {
    throw new Error(error);
  }
});
const updateUserByAdmin = asyncHandler(async (req, res) => {
  try {
    const { uid } = req.params;
    if (Object.keys(req.body).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Missing inputs",
      });
    }
    const user = await User.findByIdAndUpdate(uid, req.body, {
      new: true,
    }).select("-password -role");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    return res.status(200).json({
      success: true,
      updateUser: user,
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

module.exports = {
  register,
  login,
  logout,
  getallAccount,
  getOneUser,
  refreshAccessToken,
  forgotPassword,
  resetPassword,
  deleteUser,
  updateUserByUser,
  updateUserByAdmin,
};
