const router = require("express").Router();
const uploadCloud = require("../../middlewares/uploadimg");
const UserControls = require("./controller");
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
router.get("/listfav", [verifyAccessToken], UserControls.getFavorites);
router.put("/favoritePet", [verifyAccessToken], UserControls.addFavorite);

router.get("/cart", [verifyAccessToken], UserControls.getCarts);
router.put("/cart", [verifyAccessToken], UserControls.shoppingCart);
router.put("/updateCartQuantity", [verifyAccessToken], UserControls.updateCartQuantity);
router.delete("/deleteOneCart", [verifyAccessToken], UserControls.deleteOneCart);
router.delete(
  "/deleteAllCart",
  [verifyAccessToken],
  UserControls.deleteAllCart,
);

router.post("/address", [verifyAccessToken], UserControls.addAddress);
router.delete(
  "/address/:addressIndex",
  [verifyAccessToken],
  UserControls.deleteAddress,
);
router.put(
  "/change-address/:addressIndex",
  verifyAccessToken,
  UserControls.changeAddress,
);
router.put("/change-default-address/:addressIndex", [verifyAccessToken], UserControls.changeDefaultAddress);

router.put("/change-password", [verifyAccessToken], UserControls.changePassword);
router.put("/add-voucher", [verifyAccessToken], UserControls.addVoucher);
router.get("/vouchers", [verifyAccessToken], UserControls.getVouchers);

module.exports = router;
