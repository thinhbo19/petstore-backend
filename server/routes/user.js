const router = require("express").Router();
const UserControls = require("../controllers/user");
const { verifyAccessToken, isAdmin } = require("../middlewares/verifyToken");

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
router.put("/resetpassword", UserControls.resetPassword);
router.delete("/delete", [verifyAccessToken, isAdmin], UserControls.deleteUser);
router.put("/update", [verifyAccessToken], UserControls.updateUserByUser);
router.put(
  "/:uid",
  [verifyAccessToken, isAdmin],
  UserControls.updateUserByAdmin
);

module.exports = router;
