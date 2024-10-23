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
router.post("/createUrl", OrderControl.handlePaymentUrl);
router.get("/vnpay_return", OrderControl.handleVnPayReturn);

module.exports = router;
