const router = require("express").Router();
const { getAllSystemApis, updateSystemApiNote } = require("./controller");
const { verifyAccessToken, isStrictAdmin } = require("../../middlewares/verifyToken");

router.get("/", [verifyAccessToken, isStrictAdmin], getAllSystemApis);
router.put("/note", [verifyAccessToken, isStrictAdmin], updateSystemApiNote);

module.exports = router;
