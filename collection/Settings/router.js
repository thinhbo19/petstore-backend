const router = require("express").Router();
const { verifyAccessToken, isStrictAdmin } = require("../../middlewares/verifyToken");
const SettingsControl = require("./controller");

router.get("/", [verifyAccessToken, isStrictAdmin], SettingsControl.getSettings);
router.put("/", [verifyAccessToken, isStrictAdmin], SettingsControl.updateSettings);

module.exports = router;
