const router = require("express").Router();
const { verifyAccessToken, isAdmin } = require("../../middlewares/verifyToken");
const TypeServiceControll = require("./controller");

module.exports = router;
