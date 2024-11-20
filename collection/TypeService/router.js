const router = require("express").Router();
const { verifyAccessToken, isAdmin } = require("../../middlewares/verifyToken");
const TypeServiceControll = require("./controller");
const uploadCloud = require("../../middlewares/uploadimg");

router.post(
  "/",
  [verifyAccessToken, isAdmin],
  TypeServiceControll.createService
);

router.get("/", TypeServiceControll.getAllServices);

router.get("/spa", TypeServiceControll.getAllSpaServices);
router.get("/hotel", TypeServiceControll.getAllHotelServices);

router.get("/:serviceID", TypeServiceControll.getServiceById);

router.put(
  "/change/:serviceID",
  [verifyAccessToken, isAdmin],
  TypeServiceControll.updateService
);

router.delete(
  "/:serviceID",
  [verifyAccessToken, isAdmin],
  TypeServiceControll.deleteService
);

router.post(
  "/rating/:serId",
  uploadCloud.array("feedback_img"),
  TypeServiceControll.postRating
);

module.exports = router;
