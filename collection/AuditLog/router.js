const router = require("express").Router();
const { getAuditLogs } = require("./controller");
const { verifyAccessToken, isStrictAdmin } = require("../../middlewares/verifyToken");

router.get("/", [verifyAccessToken, isStrictAdmin], getAuditLogs);

module.exports = router;
