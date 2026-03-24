const router = require("express").Router();
const { verifyAccessToken } = require("../../middlewares/verifyToken");
const ChatControls = require("./controller");

router.post("/", verifyAccessToken, ChatControls.createChat);
router.get("/my-chat", verifyAccessToken, ChatControls.getMyChat);
router.get(
  "/staff-conversations",
  verifyAccessToken,
  ChatControls.getStaffConversations,
);
router.get("/findone/:_id", verifyAccessToken, ChatControls.findOneChat);
router.get(
  "/conversation/:firstId/:secondId",
  verifyAccessToken,
  ChatControls.findChat,
);
router.get("/find/:firtsId/:secondId", verifyAccessToken, ChatControls.findChat);
router.get("/:userId", verifyAccessToken, ChatControls.findUserChat);
router.delete("/:_id", verifyAccessToken, ChatControls.deleteChat);

module.exports = router;
