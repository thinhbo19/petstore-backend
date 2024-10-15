const User = require("./model");
const Pet = require("../Pets/model");
const Product = require("../Product/model");
const asyncHandler = require("express-async-handler");
const {
  generateAccessToken,
  generateRefreshToken,
} = require("../../middlewares/jwt");
const jwt = require("jsonwebtoken");
const sendMail = require("../../utils/sendMail");
const crypto = require("crypto");
const bcrypt = require("bcrypt");

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
      const newUser = await User.create({
        email: email,
        password: password,
        username: username,
        mobile: mobile,
        isBlocked: true,
      });
      const activationUrl = `${process.env.URL_CLIENT}/activate-account/${newUser._id}`;
      const html = `Xin vui lòng click vào link dưới đây để kích hoạt tài khoản của bạn: <a href="${activationUrl}">Click Here</a>`;
      const data = {
        email: email,
        html,
      };
      await sendMail(data);
      if (newUser) {
        return res.status(200).json({
          success: true,
          message:
            "Registration successful. Please check your email to active your account!",
          data: newUser,
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
    const { userId } = req.body;
    const user = await User.findByIdAndUpdate(
      userId,
      { isBlocked: false },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Invalid activation link or user does not exist.",
      });
    }
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

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User not found",
      });
    }
    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Your account has been blocked.",
      });
    }
    const isPasswordCorrect = await user.isCorrectPassword(password);

    if (!isPasswordCorrect) {
      return res.status(400).json({
        success: false,
        message: "Invalid Password",
      });
    }

    const {
      password: userPassword,
      refreshToken,
      ...userData
    } = user.toObject();
    const accessToken = generateAccessToken(user._id, user.role);
    const newRefreshToken = generateRefreshToken(user._id);

    await User.findByIdAndUpdate(
      user._id,
      { refreshToken: newRefreshToken },
      { new: true }
    );

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      userData,
      accessToken,
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
    const user = await User.find().select("-refreshToken -password");
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
      "-refreshToken -password -role"
    );
    if (!user) {
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
    return res.status(400).json({
      success: false,
      message: "Missing email!",
    });
  }
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }
  const resetToken = user.createPasswordChangeToken();
  await user.save();
  const resetUrl = `${process.env.URL_CLIENT}/reset-password/${resetToken}`;
  const html = `Xin vui lòng click vào link dưới đây để thay đổi mật khẩu của bạn. Link này sẽ hết hạn sau 15 phút kể từ bây giờ. <a href="${resetUrl}">Click Here</a>`;
  const data = {
    email: email,
    html,
  };
  const sendMailResponse = await sendMail(data);
  return res.status(200).json({
    success: true,
    message: "Please check your email!",
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
const changePassword = async (req, res) => {
  const { userId, currentPassword, newPassword, confirmPassword } = req.body;

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

  res.status(200).json({ message: "Password updated successfully" });
};
const deleteUser = asyncHandler(async (req, res) => {
  try {
    const { uid } = req.body;
    if (!uid) {
      return res.status(400).json({ success: false, message: "Missing Id!!" });
    }
    const user = await User.findByIdAndDelete(uid);
    return res.status(200).json({
      success: true,
      message: `User with email ${user.email} has been deleted`,
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
    const { userId, isBlocked } = req.body;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.isBlocked = isBlocked !== undefined ? isBlocked : user.isBlocked;
    const updatedUser = await user.save();

    res.status(200).json({
      message: "User updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});
const changeRole = asyncHandler(async (req, res) => {
  try {
    const { userId, newRole } = req.body;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found!!" });
    }
    const validRoles = ["Admin", "User", "Staff"];
    if (!validRoles.includes(newRole)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    user.role = newRole;
    const updatedUser = await user.save();

    res.status(200).json({
      message: "Change role successfully",
      user: updatedUser,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error when change",
      error: error.message,
    });
  }
});
const addFavoritePet = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const { petID, imgPet, namePet, nameBreed, nameSpecies, age, gender, price } =
    req.body;

  try {
    const user = await User.findById(_id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const existingPetIndex = user.favoritePets.findIndex(
      (pet) => pet.petID.toString() === petID
    );

    if (existingPetIndex !== -1) {
      user.favoritePets.splice(existingPetIndex, 1);
      await user.save();
      return res.status(200).json({
        data: user.favoritePets,
        message:
          "The pet has been successfully removed from your favorite list",
      });
    }

    user.favoritePets.push({
      petID,
      imgPet,
      namePet,
      nameBreed,
      nameSpecies,
      age,
      gender,
      price,
    });
    await user.save();
    res.status(201).json({
      message: "The pet has been added to your favorite list",
      data: user.favoritePets,
    });
  } catch (error) {
    console.error("Error while adding favorite pet:", error);
    res
      .status(500)
      .json({ message: "An error occurred while adding favorite pet" });
  }
});
const addFavoriteProduct = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const { productID, nameProduct, nameBrand, nameCate, price, images } =
    req.body;

  try {
    const user = await User.findById(_id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const existingProductIndex = user.favoriteProduct.findIndex(
      (product) => product.productID.toString() === productID
    );

    if (existingProductIndex !== -1) {
      user.favoriteProduct.splice(existingProductIndex, 1);
      await user.save();
      return res.status(200).json({
        message:
          "The product has been successfully removed from your favorite list",
      });
    }

    user.favoriteProduct.push({
      productID,
      nameProduct,
      nameBrand,
      nameCate,
      price,
      images,
    });
    await user.save();
    res.status(201).json({
      message: "The product has been added to your favorite list",
      data: user.favoriteProduct,
    });
  } catch (error) {
    console.error("Error while adding favorite product:", error);
    res
      .status(500)
      .json({ message: "An error occurred while adding favorite product" });
  }
});
const getFavorites = asyncHandler(async (req, res) => {
  const { _id } = req.user;

  try {
    const user = await User.findById(_id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const allFavorites = [...user.favoritePets, ...user.favoriteProduct];
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
      };
    }

    if (!itemInfo) {
      itemInfo = await Product.findById(id);
      images = itemInfo.images[0];
      displayInfo = {
        name: itemInfo.nameProduct,
        quantity: itemInfo.quantity,
        price: itemInfo.price,
      };
    }

    if (!itemInfo) {
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

const deleteCart = async (req, res) => {
  const { _id } = req.user;
  const { id } = req.body;

  try {
    const user = await User.findById(_id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const existingID = user.cart.findIndex((item) => item.id.toString() === id);
    if (existingID === -1) {
      return res.status(404).json({
        message: "Item not found in your cart",
      });
    }
    user.cart.splice(existingID, 1);
    await user.save();

    return res.status(200).json({
      message: "Item removed from your cart",
      data: user.cart,
    });
  } catch (error) {
    console.error("Error while removing item from cart:", error);
    return res.status(500).json({
      message: "An error occurred while removing item from the cart",
      error: error.message,
    });
  }
};

const deleteAllCart = asyncHandler(async (req, res) => {
  const { _id } = req.user;

  try {
    const user = await User.findById(_id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.cart = [];

    await user.save();

    res.status(200).json({
      message: "All items removed from your cart",
      data: user.cart,
    });
  } catch (error) {
    console.error("Error while deleting all items in cart:", error.message);
    res.status(500).json({
      message: "An error occurred while deleting all items in the cart",
      error: error.message,
    });
  }
});

const addAddress = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const { address } = req.body;
  try {
    const user = await User.findById(_id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.Address.push(address);
    await user.save();

    res.status(201).json({
      message: "Address added successfully",
      data: user.Address,
    });
  } catch (error) {
    res.status(500).json({ message: "An error occurred while adding address" });
  }
});
const deleteAddress = async (req, res) => {
  const { _id } = req.user;
  const addressIndex = req.params.addressIndex;

  try {
    const user = await User.findById(_id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (addressIndex < 0 || addressIndex >= user.Address.length) {
      return res.status(400).json({ message: "Invalid address index" });
    }
    user.Address.splice(addressIndex, 1);

    await user.save();

    return res.status(200).json({ message: "Address deleted successfully" });
  } catch (error) {
    console.error("Error deleting address:", error);
    return res
      .status(500)
      .json({ message: "An error occurred while deleting address" });
  }
};

module.exports = {
  register,
  activateAccount,
  login,
  logout,
  getallAccount,
  getOneUser,
  getUserMess,
  refreshAccessToken,
  forgotPassword,
  resetPassword,
  deleteUser,
  updateUserByUser,
  blockAccount,
  changeRole,
  addFavoritePet,
  addFavoriteProduct,
  getFavorites,
  addAddress,
  deleteAddress,
  changePassword,
  shoppingCart,
  deleteCart,
  deleteAllCart,
};
