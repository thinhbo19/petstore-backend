const router = require("express").Router();
const uploadCloud = require("../../middlewares/uploadimg");
const UserControls = require("./controller");
const { verifyAccessToken, isAdmin } = require("../../middlewares/verifyToken");

router.post("/register", UserControls.register);
router.post("/login", UserControls.login);
router.get("/logout", UserControls.logout);
router.get(
  "/allUser",
  [verifyAccessToken, isAdmin],
  UserControls.getallAccount
);
router.get("/current", verifyAccessToken, UserControls.getOneUser);
router.post("/refreshtoken", UserControls.refreshAccessToken);
router.get("/forgotpassword", UserControls.forgotPassword);
router.patch("/resetpassword", UserControls.resetPassword);
router.delete("/delete", [verifyAccessToken, isAdmin], UserControls.deleteUser);
router.patch(
  "/update",
  [verifyAccessToken],
  uploadCloud.single("Avatar"),
  UserControls.updateUserByUser
);
router.patch(
  "/:uid",
  [verifyAccessToken, isAdmin],
  UserControls.updateUserByAdmin
);

module.exports = router;
