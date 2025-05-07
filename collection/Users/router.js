const router = require("express").Router();
const uploadCloud = require("../../middlewares/uploadimg");
const UserControls = require("./controller");
const { verifyAccessToken, isAdmin } = require("../../middlewares/verifyToken");

router.post(
  "/create-new-account",
  [verifyAccessToken, isAdmin],
  UserControls.createAccount
);
router.post("/register", UserControls.register);
router.post("/verify-otp", UserControls.activateAccount);
router.post("/resend-otp", UserControls.resendOTP);
router.post("/login", UserControls.login);
router.get("/logout", UserControls.logout);
//get user
router.get("/allUser", UserControls.getallAccount);
router.get("/current", verifyAccessToken, UserControls.getOneUser);
router.get(
  "/userCurrent",
  [verifyAccessToken, isAdmin],
  UserControls.getUserMess
);
//password
router.post("/refreshtoken", UserControls.refreshAccessToken);
router.post("/forgotpassword", UserControls.forgotPassword);
router.post("/resetpassword", UserControls.resetPassword);
router.post("/verify-reset-token", UserControls.verifyResetToken);
//delete user
router.delete(
  "/delete-user/:uid",
  [verifyAccessToken, isAdmin],
  UserControls.deleteUser
);
router.patch(
  "/update",
  [verifyAccessToken],
  uploadCloud.single("Avatar"),
  UserControls.updateUserByUser
);
router.put(
  "/adminUpdate/:userId",
  [verifyAccessToken, isAdmin],
  UserControls.blockAccount
);
router.patch(
  "/changeRole",
  [verifyAccessToken, isAdmin],
  UserControls.changeRole
);
//favorite
router.get("/listfav", [verifyAccessToken], UserControls.getFavorites);
router.put("/favoritePet", [verifyAccessToken], UserControls.addFavorite);

// cart
router.put("/cart", [verifyAccessToken], UserControls.shoppingCart);
router.delete("/allCart", [verifyAccessToken], UserControls.deleteAllCart);
router.delete("/allOneCart", UserControls.deleteCart);

//address
router.post("/address", [verifyAccessToken], UserControls.addAddress);
router.delete(
  "/address/:addressIndex",
  [verifyAccessToken],
  UserControls.deleteAddress
);
// Add this route to your user routes file
router.put(
  "/change-address/:addressIndex",
  verifyAccessToken,
  UserControls.changeAddress
);

router.put("/change-password", UserControls.changePassword);
router.put("/add-voucher", [verifyAccessToken], UserControls.addVoucher);
router.get("/vouchers", [verifyAccessToken], UserControls.getVouchers);

module.exports = router;
