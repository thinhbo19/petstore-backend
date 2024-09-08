const router = require("express").Router();
const { verifyAccessToken, isAdmin } = require("../../middlewares/verifyToken");
const MessControls = require("./controller");

router.post("/", MessControls.createMess);
router.get("/:chatId", MessControls.getMess);

module.exports = router;
