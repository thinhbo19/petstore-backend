const uploadCloud = require("../../middlewares/uploadimg");
const router = require("express").Router();
const newsControlls = require("./controler");
const { verifyAccessToken, isAdmin } = require("../../middlewares/verifyToken");

router.post(
  "/addNews",
  // [verifyAccessToken, isAdmin],
  uploadCloud.array("image"),
  newsControlls.createNews
);

module.exports = router;
