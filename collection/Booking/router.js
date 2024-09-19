const router = require("express").Router();
const { verifyAccessToken, isAdmin } = require("../../middlewares/verifyToken");
const BookingControll = require("./controller");

module.exports = router;
