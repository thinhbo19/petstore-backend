const router = require("express").Router();
const { verifyAccessToken, isAdmin } = require("../../middlewares/verifyToken");
const TypeServiceControll = require("./controller");

router.post(
  "/",
  [verifyAccessToken, isAdmin],
  TypeServiceControll.createService
);

router.get(
  "/",
  [verifyAccessToken, isAdmin],
  TypeServiceControll.getAllServices
);

router.get(
  "/:serviceID",
  [verifyAccessToken, isAdmin],
  TypeServiceControll.getServiceById
);

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

module.exports = router;
