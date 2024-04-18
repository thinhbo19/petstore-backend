const router = require("express").Router();
const { verifyAccessToken, isAdmin } = require("../middlewares/verifyToken");
const BrandControls = require("../controllers/brand");

router.post(
  "/addBrand",
  //   [verifyAccessToken, isAdmin],
  BrandControls.createBrand
);

module.exports = router;
