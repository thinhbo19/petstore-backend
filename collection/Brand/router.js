const router = require("express").Router();
const { verifyAccessToken, isAdmin } = require("../../middlewares/verifyToken");
const BrandControls = require("./controller");

router.post(
  "/addBrand",
  [verifyAccessToken, isAdmin],
  BrandControls.createBrand
);
router.get("/", [verifyAccessToken, isAdmin], BrandControls.getAllBrand);
router.patch(
  "/:brandId",
  [verifyAccessToken, isAdmin],
  BrandControls.changeBrand
);
router.delete(
  "/:brandId",
  [verifyAccessToken, isAdmin],
  BrandControls.deleteBrand
);
module.exports = router;
