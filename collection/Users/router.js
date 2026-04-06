const router = require("express").Router();
const uploadCloud = require("../../middlewares/uploadimg");
const UserControls = require("./controller");
const CartControls = require("./cartController");
const FavoriteControls = require("./favoritesController");
const AddressControls = require("./addressController");
const VoucherControls = require("./voucherController");
const {
  verifyAccessToken,
  isAdmin,
  isStrictAdmin,
} = require("../../middlewares/verifyToken");
const {
  loginLimiter,
  registerLimiter,
  otpLimiter,
  resetPasswordLimiter,
} = require("../../middlewares/rateLimiter");

router.post(
  "/create-new-account",
  [verifyAccessToken, isStrictAdmin],
  UserControls.createAccount,
);
router.post("/register", registerLimiter, UserControls.register);
router.post("/login", loginLimiter, UserControls.login);
router.post("/verify-otp", otpLimiter, UserControls.activateAccount);
router.post("/resend-otp", otpLimiter, UserControls.resendOTP);
router.get("/logout", UserControls.logout);
router.get("/allUser", [verifyAccessToken, isStrictAdmin], UserControls.getallAccount);
router.get("/current", verifyAccessToken, UserControls.getOneUser);
router.get(
  "/userCurrent",
  [verifyAccessToken, isAdmin],
  UserControls.getUserMess,
);
router.post("/refreshtoken", UserControls.refreshAccessToken);
router.post("/forgotpassword", resetPasswordLimiter, UserControls.forgotPassword);
router.post("/forgotpassword-otp", resetPasswordLimiter, UserControls.forgotPasswordOtp);
router.post("/verify-forgot-otp", resetPasswordLimiter, UserControls.verifyForgotPasswordOtp);
router.post("/resetpassword-otp", resetPasswordLimiter, UserControls.resetPasswordByOtp);
router.post("/resetpassword", resetPasswordLimiter, UserControls.resetPassword);
router.post("/verify-reset-token", resetPasswordLimiter, UserControls.verifyResetToken);
router.delete(
  "/delete-user/:uid",
  [verifyAccessToken, isStrictAdmin],
  UserControls.deleteUser,
);
router.patch(
  "/update",
  [verifyAccessToken],
  uploadCloud.single("Avatar"),
  UserControls.updateUserByUser,
);
router.put(
  "/adminUpdate/:userId",
  [verifyAccessToken, isStrictAdmin],
  UserControls.blockAccount,
);
router.patch(
  "/changeRole",
  [verifyAccessToken, isStrictAdmin],
  UserControls.changeRole,
);
router.get("/listfav", [verifyAccessToken], FavoriteControls.getFavorites);
router.put("/favoritePet", [verifyAccessToken], FavoriteControls.addFavorite);

router.get("/cart", [verifyAccessToken], CartControls.getCarts);
router.put("/cart", [verifyAccessToken], CartControls.shoppingCart);
router.put("/updateCartQuantity", [verifyAccessToken], CartControls.updateCartQuantity);
router.delete("/deleteOneCart", [verifyAccessToken], CartControls.deleteOneCart);
router.delete(
  "/deleteAllCart",
  [verifyAccessToken],
  CartControls.deleteAllCart,
);

router.post("/address", [verifyAccessToken], AddressControls.addAddress);
router.delete(
  "/address/:addressIndex",
  [verifyAccessToken],
  AddressControls.deleteAddress,
);
router.put(
  "/change-address/:addressIndex",
  verifyAccessToken,
  AddressControls.changeAddress,
);
router.put("/change-default-address/:addressIndex", [verifyAccessToken], AddressControls.changeDefaultAddress);

router.put("/change-password", [verifyAccessToken], UserControls.changePassword);
router.put("/add-voucher", [verifyAccessToken], VoucherControls.addVoucher);
router.get("/vouchers", [verifyAccessToken], VoucherControls.getVouchers);

module.exports = router;
