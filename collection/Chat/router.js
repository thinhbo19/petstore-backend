const router = require("express").Router();
const { verifyAccessToken, isAdmin } = require("../../middlewares/verifyToken");
const ChatControls = require("./controller");

router.post("/", ChatControls.createChat);
router.get("/findone/:_id", ChatControls.findOneChat);
router.get("/:userId", ChatControls.findUserChat);
router.get("/find/:firtsId/:secondId", ChatControls.findChat);
router.delete("/:_id", ChatControls.deleteChat);

module.exports = router;
