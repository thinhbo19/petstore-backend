const router = require("express").Router();
const { verifyAccessToken, isAdmin } = require("../../middlewares/verifyToken");
const OrderControl = require("./controller");

router.post("/order", OrderControl.createOrder);
router.get("/", [verifyAccessToken], OrderControl.getAllOrders);
router.get("/:orderID", [verifyAccessToken, isAdmin], OrderControl.getOneOrder);
router.get("/user/:userID", [verifyAccessToken], OrderControl.getUserOrder);
router.get("/userOne/:orderID", [verifyAccessToken], OrderControl.getOneOrder);
router.delete(
  "/:orderID",
  [verifyAccessToken, isAdmin],
  OrderControl.deleteOrder
);
router.patch(
  "/update/:orderID",
  [verifyAccessToken],
  OrderControl.updateStatusOrder
);

module.exports = router;
