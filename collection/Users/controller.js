const User = require("./model");
const AuditLog = require("../AuditLog/model");
const Pet = require("../Pets/model");
const Product = require("../Product/model");
const Voucher = require("../Voucher/model");
const asyncHandler = require("express-async-handler");
const {
  generateAccessToken,
  generateRefreshToken,
} = require("../../middlewares/jwt");
const jwt = require("jsonwebtoken");
const sendMail = require("../../utils/sendMail");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { generateSlug } = require("../../service/slugifyConfig");
const {
  generateActivationEmail,
} = require("../../service/emailTemplateService");

const refreshCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};
const csrfCookieOptions = {
  httpOnly: false,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};
const issueCsrfToken = (res) => {
  const csrfToken = crypto.randomBytes(24).toString("hex");
  res.cookie("csrfToken", csrfToken, csrfCookieOptions);
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

const getRedirectUrlByRole = (role) => {
  if (role === "Admin") return "/dashboard";
  if (role === "User") return "/";
  if (role === "Staff") return "/customer-service-by-staff";
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
  try {
    const { email, password, username, mobile, role, isBlocked } = req.body;
    if (!email || !password || !username || !role) {
      return res.status(400).json({
        success: false,
        message: "Missing inputs",
      });
    }
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{3,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 3 characters long and include both letters and numbers",
      });
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists",
      });
    } else {
      const assignedStaff =
        role === "User" ? await getLeastBusyStaffId() : null;

      const newUser = await User.create({
        email: email,
        password: password,
        username: username,
        isBlocked: typeof isBlocked === "boolean" ? isBlocked : false,
        role: role,
        mobile: mobile,
        assignedStaff,
      });
      if (newUser) {
        await createAuditLog(req, "CREATE_USER", newUser, {
          createdRole: role,
          isBlocked: newUser.isBlocked,
        });
        return res.status(200).json({
          success: true,
          message: "Create account successful!",
        });
      } else {
        return res.status(500).json({
          success: false,
          message: "Something went wrong.",
        });
      }
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
      error: error.message,
    });
  }
});

// Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const register = asyncHandler(async (req, res) => {
  try {
    const { email, password, username, mobile } = req.body;
    if (!email || !password || !username || !mobile) {
      return res.status(400).json({
        success: false,
        message: "Missing inputs",
      });
    }
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters long and include both letters and numbers",
      });
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists",
      });
    } else {
      // Generate OTP
      const otp = generateOTP();
      const otpExpiry = new Date();
      otpExpiry.setMinutes(otpExpiry.getMinutes() + 5); // OTP expires in 5 minutes

      const assignedStaff = await getLeastBusyStaffId();
      const newUser = await User.create({
        email: email,
        password: password,
        username: username,
        mobile: mobile,
        isBlocked: true,
        assignedStaff,
        otp: {
          code: otp,
          expiresAt: otpExpiry,
        },
      });

      const html = generateActivationEmail(username, otp);
      const data = {
        email: email,
        subject: "Activate Your Account - OTP Verification",
        html,
        type: "activation",
      };
      await sendMail(data);

      if (newUser) {
        return res.status(200).json({
          success: true,
          message:
            "Registration successful. Please check your email for OTP verification!",
        });
      } else {
        return res.status(500).json({
          success: false,
          message: "Something went wrong during registration.",
        });
      }
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Something went wrong during registration.",
      error: error.message,
    });
  }
});

const activateAccount = asyncHandler(async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.otp || !user.otp.code || !user.otp.expiresAt) {
      return res.status(400).json({
        success: false,
        message: "No OTP found for this user",
      });
    }

    if (user.otp.code !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    if (new Date() > user.otp.expiresAt) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired",
      });
    }

    // Update user status and clear OTP
    user.isBlocked = false;
    user.otp = undefined;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Account activated successfully!",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error activating account.",
      error: error.message,
    });
  }
});

// Resend OTP
const resendOTP = asyncHandler(async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.isBlocked) {
      return res.status(400).json({
        success: false,
        message: "Account is already activated",
      });
    }

    // Generate new OTP
    const otp = generateOTP();
    const otpExpiry = new Date();
    otpExpiry.setMinutes(otpExpiry.getMinutes() + 5);

    // Update user with new OTP
    user.otp = {
      code: otp,
      expiresAt: otpExpiry,
    };
    await user.save();

    // Send new OTP email
    const html = generateActivationEmail(user.username, otp);
    const data = {
      email: email,
      subject: "New OTP for Account Activation",
      html,
      type: "activation",
    };
    await sendMail(data);

    return res.status(200).json({
      success: true,
      message: "New OTP has been sent to your email",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error sending new OTP",
      error: error.message,
    });
  }
});

const login = asyncHandler(async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Missing Email",
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Missing Password",
      });
    }

    const user = await User.findOne({ email, isDeleted: { $ne: true } }).select(
      "_id username Avatar email mobile role Address isBlocked date assignedStaff",
    );

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User not found",
      });
    }
    const userWithPassword = await User.findOne({
      email,
      isDeleted: { $ne: true },
    });
    if (userWithPassword.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Your account has been blocked.",
      });
    }

    const isPasswordCorrect =
      await userWithPassword.isCorrectPassword(password);

    if (!isPasswordCorrect) {
      return res.status(400).json({
        success: false,
        message: "Invalid Password",
      });
    }

    const userData = buildUserData(user);

    const accessToken = generateAccessToken(user._id, user.role);
    const newRefreshToken = generateRefreshToken(user._id);

    await User.findByIdAndUpdate(
      user._id,
      { refreshToken: newRefreshToken },
      { new: true },
    );

    res.cookie("refreshToken", newRefreshToken, refreshCookieOptions);
    issueCsrfToken(res);
    const url = getRedirectUrlByRole(userData.role);

    return res.status(200).json({
      success: true,
      userData,
      accessToken,
      url,
    });
  } catch (error) {
    console.error("Error during login:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong during login.",
      error: error.message,
    });
  }
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
    httpOnly: refreshCookieOptions.httpOnly,
    sameSite: refreshCookieOptions.sameSite,
    secure: refreshCookieOptions.secure,
  });
  res.clearCookie("csrfToken", {
    httpOnly: csrfCookieOptions.httpOnly,
    sameSite: csrfCookieOptions.sameSite,
    secure: csrfCookieOptions.secure,
  });
  return res.status(200).json({
    success: true,
    mess: "You are logged out!!!",
  });
});
const getallAccount = asyncHandler(async (req, res) => {
  try {
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
  } catch (error) {
    throw new Error(error);
  }
});
const getOneUser = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const user = await User.findById(_id).select(
    "-refreshToken -password -role -createdAt -updatedAt -passwordChangeAt -passwordResetExpire -passwordResetToken",
  );
  if (!user || user.isDeleted) {
    return res.status(404).json({
      success: false,
      rs: "User not found",
    });
  }
  return res.status(200).json({
    success: true,
    rs: user,
  });
});
const getUserMess = asyncHandler(async (req, res) => {
  try {
    const { _id } = req.query;
    if (!_id) {
      return res.status(400).json({
        success: false,
        message: "UID không được truyền",
      });
    }
    const user = await User.findById(_id).select(
      "-refreshToken -password -role",
    );
    if (!user || user.isDeleted) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng",
      });
    }
    res.status(200).json({
      success: true,
      message: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi máy chủ",
      error: error.message,
    });
  }
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
  const newAccessToken = generateAccessToken(response._id, response.role);
  issueCsrfToken(res);

  return res.status(200).json({
    success: true,
    userData,
    newAccessToken,
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

const changePassword = async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const userId = req.user?._id;

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const isMatch = await user.isCorrectPassword(currentPassword);
  if (!isMatch) {
    return res.status(400).json({ message: "Current password is incorrect" });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  user.password = newPassword;

  await user.save();

  res.status(200).json({ success: true, message: "Password updated successfully" });
};
const deleteUser = asyncHandler(async (req, res) => {
  try {
    const { uid } = req.params;
    const actorId = String(req.user?._id || "");
    if (!uid) {
      return res.status(400).json({ success: false, message: "Missing Id!!" });
    }

    if (actorId === String(uid)) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account",
      });
    }

    const user = await User.findById(uid);
    if (!user || user.isDeleted) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.role === "Admin") {
      const adminCount = await countActiveAdmins();
      if (adminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: "Cannot delete the last active admin account",
        });
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
  } catch (error) {
    console.error("Error in deleting user:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
});
const updateUserByUser = asyncHandler(async (req, res) => {
  try {
    const { _id } = req.user;
    if (!_id) {
      return res
        .status(400)
        .json({ success: false, message: "Missing user ID" });
    }

    let updateData = req.body;
    if (req.file && req.file.path) {
      updateData.Avatar = req.file.path;
    }

    const user = await User.findByIdAndUpdate(_id, updateData, {
      new: true,
    }).select("-password -role");
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    return res.status(200).json({ success: true, updateUser: user });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});
const blockAccount = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;
    const actorId = String(req.user?._id || "");
    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: "Missing user ID" });
    }

    if (actorId === String(userId) && req.body?.isBlocked === true) {
      return res.status(400).json({
        success: false,
        message: "You cannot block your own account",
      });
    }

    let updateData = req.body;
    if (req.file && req.file.path) {
      updateData.Avatar = req.file.path;
    }

    const targetUser = await User.findById(userId);
    if (!targetUser || targetUser.isDeleted) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (targetUser.role === "Admin" && updateData?.isBlocked === true) {
      const adminCount = await countActiveAdmins();
      if (adminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: "Cannot block the last active admin account",
        });
      }
    }

    const user = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
    }).select("-password -refreshToken");
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    await createAuditLog(req, "UPDATE_USER", user, {
      changedFields: Object.keys(updateData || {}),
    });

    return res.status(200).json({ success: true, updateUser: user });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});
const changeRole = asyncHandler(async (req, res) => {
  try {
    const { userId, newRole } = req.body;
    const actorId = String(req.user?._id || "");

    if (actorId === String(userId)) {
      return res.status(400).json({
        success: false,
        message: "You cannot change your own role",
      });
    }

    const user = await User.findById(userId);
    if (!user || user.isDeleted) {
      return res.status(404).json({ success: false, message: "User not found!!" });
    }
    const validRoles = ["Admin", "User", "Staff"];
    if (!validRoles.includes(newRole)) {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }

    if (user.role === "Admin" && newRole !== "Admin") {
      const adminCount = await countActiveAdmins();
      if (adminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: "Cannot change role of the last active admin",
        });
      }
    }

    const previousRole = user.role;
    user.role = newRole;
    const updatedUser = await user.save();

    await createAuditLog(req, "CHANGE_ROLE", updatedUser, {
      from: previousRole,
      to: newRole,
    });

    res.status(200).json({
      success: true,
      message: "Change role successfully",
      user: updatedUser,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error when change",
      error: error.message,
    });
  }
});
const addFavorite = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const { pid } = req.body;

  try {
    const user = await User.findById(_id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const existingPetIndex = user.favorites.findIndex(
      (pet) => pet.id.toString() === pid,
    );

    if (existingPetIndex !== -1) {
      user.favorites.splice(existingPetIndex, 1);
      await user.save();
      return res.status(200).json({
        data: user.favorites,
        message:
          "The pet has been successfully removed from your favorite list",
      });
    }

    let existingData = await Pet.findById(pid);
    if (!existingData) {
      existingData = await Product.findById(pid);
      if (existingData) {
        user.favorites.push({
          id: pid,
          img: existingData.images[0],
          name: existingData.nameProduct,
          type: "Product",
          price: existingData.price,
          url: `/accessories/${generateSlug(existingData.nameProduct)}`,
        });
      } else {
        return res.status(404).json({ message: "Item not found" });
      }
    } else {
      let url = "";
      if (existingData.type === "Cat") {
        url = `/cats/${generateSlug(existingData.namePet)}`;
      } else {
        url = `/dogs/${generateSlug(existingData.namePet)}`;
      }
      user.favorites.push({
        id: pid,
        img: existingData.imgPet[0],
        name: existingData.namePet,
        type: "Pet",
        price: existingData.price,
        url: url,
      });
    }

    await user.save();
    res.status(201).json({
      message: "The item has been added to your favorite list",
      data: user.favorites,
    });
  } catch (error) {
    console.error("Error while adding favorite item:", error);
    res
      .status(500)
      .json({ message: "An error occurred while adding favorite item" });
  }
});

const getFavorites = asyncHandler(async (req, res) => {
  const { _id } = req.user;

  try {
    const user = await User.findById(_id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const allFavorites = user.favorites;
    allFavorites.sort((a, b) => b.createdAt - a.createdAt);

    res.status(200).json({
      message: "List of favorite items",
      favorites: allFavorites.reverse(),
    });
  } catch (error) {
    console.error("Error while fetching favorites:", error);
    res
      .status(500)
      .json({ message: "An error occurred while fetching favorites" });
  }
});

const getCarts = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  try {
    const user = await User.findById(_id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({
      success: true,
      cart: user.cart,
    });
  } catch (error) {
    console.error("Error while fetching cart:", error);
    res.status(500).json({ message: "An error occurred while fetching cart" });
  }
});
const shoppingCart = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const { id, quantity } = req.body;

  try {
    const user = await User.findById(_id);
    let images;
    let displayInfo;

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (!quantity || typeof quantity !== "number" || quantity <= 0) {
      return res.status(400).json({ message: "Invalid quantity value" });
    }

    const existingID = user.cart.findIndex((item) => item.id.toString() === id);

    if (existingID !== -1) {
      user.cart[existingID].quantity = quantity;
      user.cart[existingID].newPrice =
        user.cart[existingID].info.price * user.cart[existingID].quantity;

      await user.save();
      return res.status(200).json({
        cart: {
          id,
          info: user.cart[existingID].info,
          quantity: user.cart[existingID].quantity,
          newPrice: user.cart[existingID].newPrice,
          images: user.cart[existingID].images,
        },
        message: "Quantity updated in your cart",
      });
    }
    let itemInfo = await Pet.findById(id);
    if (itemInfo) {
      images = itemInfo.imgPet[0];
      displayInfo = {
        name: itemInfo.namePet,
        quantity: itemInfo.quantity,
        price: itemInfo.price,
        slug: `/shop/${generateSlug(
          itemInfo.petBreed.nameSpecies,
        )}/${generateSlug(itemInfo.petBreed.nameBreed)}/${generateSlug(
          itemInfo.namePet,
        )}`,
      };
    } else if (!itemInfo) {
      itemInfo = await Product.findById(id);
      images = itemInfo.images[0];
      displayInfo = {
        name: itemInfo.nameProduct,
        quantity: itemInfo.quantity,
        price: itemInfo.price,
        slug: `/accessory/${generateSlug(
          itemInfo.category.nameCate,
        )}/${generateSlug(itemInfo.nameProduct)}`,
      };
    } else {
      return res.status(404).json({
        message: "Item not found in Pet or Product collections",
      });
    }

    const newPrice = itemInfo.price * quantity;

    const newItem = {
      id,
      info: displayInfo,
      quantity,
      newPrice: newPrice,
      images,
    };

    user.cart.push({
      id,
      info: displayInfo,
      quantity,
      newPrice: newPrice,
      images,
    });
    await user.save();
    res.status(201).json({
      message: "Successfully added to your cart",
      cart: newItem,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "An error occurred" });
  }
});
const updateCartQuantity = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const { id, quantity } = req.body;
  try {
    const user = await User.findById(_id);
    if (!user) {
      return res.status(404).json({ message: "User not found", success: false });
    }
    const existingID = user.cart.findIndex((item) => item.id.toString() === id);
    if (existingID === -1) {
      return res.status(404).json({
        message: "Item not found in your cart",
        success: false,
      });
    }
    user.cart[existingID].quantity = quantity;
    await user.save();
    return res.status(200).json({
      message: "Cart quantity updated successfully",
      success: true,
    }); 
  } catch (error) {
    return res.status(500).json({ success: false, message: "An error occurred" });
  }
});
const deleteOneCart = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const { id } = req.body;

  if (!_id) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  if (!id) {
    return res.status(400).json({ success: false, message: "Missing cart item id" });
  }

  const user = await User.findById(_id);
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  const existingID = user.cart.findIndex((item) => String(item.id) === String(id));
  if (existingID === -1) {
    return res.status(404).json({ success: false, message: "Item not found in your cart" });
  }

  user.cart.splice(existingID, 1);
  await user.save();

  return res.status(200).json({ success: true, message: "Item removed from your cart" });
});
const deleteAllCart = asyncHandler(async (req, res) => {
  const { _id } = req.user;

  try {
    const user = await User.findById(_id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    user.cart = [];

    await user.save();

    res.status(200).json({
      success: true,
      message: "All items removed from your cart",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "An error occurred while deleting all items in the cart" });
  }
});

const addAddress = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const { address } = req.body;
  try {
    const user = await User.findById(_id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" }); 
    }

    user.Address.push({ address: address, settingDefault: false });
    await user.save();

    res.status(201).json({ success: true, message: "Address added successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "An error occurred while adding address" });
  }
});
const deleteAddress = async (req, res) => {
  const { _id } = req.user;
  const addressIndex = req.params.addressIndex;

  try {
    const user = await User.findById(_id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    if (addressIndex < 0 || addressIndex >= user.Address.length) {
      return res.status(400).json({ success: false, message: "Invalid address index" });
    }
    user.Address.splice(addressIndex, 1);

    await user.save();

    return res.status(200).json({ success: true, message: "Address deleted successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "An error occurred while deleting address" });
  }
};
const changeAddress = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const { addressIndex } = req.params;
  const { address } = req.body;

  try {
    const user = await User.findById(_id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if the address index is valid
    if (addressIndex < 0 || addressIndex >= user.Address.length) {
      return res.status(400).json({
        success: false,
        message: "Invalid address index",
      });
    }

    // Update the address at the specified index
    user.Address[addressIndex].address = address;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Address updated successfully",
    });
  } catch (error) {
    console.error("Error updating address:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while updating address",
      error: error.message,
    });
  }
});
const changeDefaultAddress = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const { addressIndex } = req.params;

  try {
    const user = await User.findById(_id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    user.Address.forEach((address) => {
      address.settingDefault = false;
    });
    user.Address[addressIndex].settingDefault = true;
    await user.save();
    return res.status(200).json({ message: "Default address changed successfully" });
  } catch (error) {
    return res.status(500).json({ message: "An error occurred while changing default address" });
  }
});

const addVoucher = asyncHandler(async (req, res) => {
  try {
    const { _id } = req.user;
    const { voucherId } = req.body;
    const user = await User.findById(_id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const existingVoucher = user.Voucher.find(
      (voucher) => voucher.voucherID.toString() === voucherId,
    );
    if (existingVoucher) {
      return res
        .status(400)
        .json({ message: "Voucher already exists for this user." });
    }
    user.Voucher.push({ voucherID: voucherId });
    await user.save();
    return res.status(200).json({ message: "Voucher added successfully!" });
  } catch (error) {
    res.status(500).json({ message: "An error" });
  }
});
const getVouchers = asyncHandler(async (req, res) => {
  try {
    const { _id } = req.user;
    const user = await User.findById(_id).populate("Voucher.voucherID");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const currentDate = new Date();

    const validVouchers = user.Voucher.filter((voucher) => {
      const voucherExpiry = voucher.voucherID.expiry;
      return voucherExpiry && voucherExpiry > currentDate; // So sánh ngày expiry với ngày hiện tại
    }).map((voucher) => voucher.voucherID);

    return res.status(200).json({ vouchers: validVouchers });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "An error occurred while retrieving the vouchers." });
  }
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
  resetPassword,
  verifyResetToken,
  deleteUser,
  updateUserByUser,
  blockAccount,
  changeRole,
  addFavorite,
  getFavorites,
  addAddress,
  deleteAddress,
  changeAddress,
  changeDefaultAddress,
  changePassword,
  getCarts,
  shoppingCart,
  updateCartQuantity,
  deleteOneCart,
  deleteAllCart,
  addVoucher,
  getVouchers,
};
