const router = require("express").Router();
const { verifyAccessToken, isAdmin } = require("../../middlewares/verifyToken");
const VoucherControl = require("./controller");

module.exports = router;
