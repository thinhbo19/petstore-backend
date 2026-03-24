const router = require("express").Router();
const { verifyAccessToken } = require("../../middlewares/verifyToken");
const uploadCloud = require("../../middlewares/uploadimg");
const MessControls = require("./controller");

router.post(
  "/",
  verifyAccessToken,
  uploadCloud.single("image"),
  MessControls.createMess,
);
router.get("/:chatId", verifyAccessToken, MessControls.getMess);

module.exports = router;
