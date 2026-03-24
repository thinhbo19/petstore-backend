const router = require("express").Router();
const { verifyAccessToken, isStrictAdmin } = require("../../middlewares/verifyToken");
const TypeServiceControll = require("./controller");
const uploadCloud = require("../../middlewares/uploadimg");

router.post(
  "/",
  [verifyAccessToken, isStrictAdmin],
  TypeServiceControll.createService
);

router.get("/", TypeServiceControll.getAllServices);

router.get("/spa", TypeServiceControll.getAllSpaServices);
router.get("/hotel", TypeServiceControll.getAllHotelServices);

router.get("/:serviceID", TypeServiceControll.getServiceById);

router.put(
  "/change/:serviceID",
  [verifyAccessToken, isStrictAdmin],
  TypeServiceControll.updateService
);

router.delete(
  "/:serviceID",
  [verifyAccessToken, isStrictAdmin],
  TypeServiceControll.deleteService
);

router.post(
  "/rating/:serId",
  [verifyAccessToken],
  uploadCloud.array("feedback_img"),
  TypeServiceControll.postRating
);

router.get("/ratings/:type", TypeServiceControll.getRatingsByType);

module.exports = router;
