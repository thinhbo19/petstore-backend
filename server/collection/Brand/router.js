const router = require("express").Router();
const { verifyAccessToken, isAdmin } = require("../../middlewares/verifyToken");
const BrandControls = require("./controller");

router.post(
  "/addBrand",
  //   [verifyAccessToken, isAdmin],
  BrandControls.createBrand
);

module.exports = router;
