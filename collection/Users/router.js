const router = require("express").Router();
const uploadCloud = require("../../middlewares/uploadimg");
const UserControls = require("./controller");
const { verifyAccessToken, isAdmin } = require("../../middlewares/verifyToken");

router.post("/register", UserControls.register);
router.post("/activate-account", UserControls.activateAccount);
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
router.get("/forgotpassword", UserControls.forgotPassword);
router.patch("/resetpassword", UserControls.resetPassword);
//delete user
router.delete("/", [verifyAccessToken, isAdmin], UserControls.deleteUser);
router.patch(
  "/update",
  [verifyAccessToken],
  uploadCloud.single("Avatar"),
  UserControls.updateUserByUser
);
router.patch(
  "/adminUpdate",
  [verifyAccessToken, isAdmin],
  UserControls.blockAccount
);
router.patch(
  "/changeRole",
  [verifyAccessToken, isAdmin],
  UserControls.changeRole
);
//favorite
router.put("/favoritePet", [verifyAccessToken], UserControls.addFavoritePet);
router.put(
  "/favoriteProduct",
  [verifyAccessToken],
  UserControls.addFavoriteProduct
);
// cart
router.put("/cart", [verifyAccessToken], UserControls.shoppingCart);
router.delete("/allCart", [verifyAccessToken], UserControls.deleteAllCart);
router.delete("/allOneCart", [verifyAccessToken], UserControls.deleteCart);

router.get("/listfav", [verifyAccessToken], UserControls.getFavorites);

//address
router.post("/address", [verifyAccessToken], UserControls.addAddress);
router.delete(
  "/address/:addressIndex",
  [verifyAccessToken],
  UserControls.deleteAddress
);

router.put("/change-password", UserControls.changePassword);

module.exports = router;
