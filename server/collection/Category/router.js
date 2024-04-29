const router = require("express").Router();
const { verifyAccessToken, isAdmin } = require("../../middlewares/verifyToken");
const CateControll = require("./controller");

router.post(
  "/addCate",
  //   [verifyAccessToken, isAdmin],
  CateControll.createCategory
);

module.exports = router;
