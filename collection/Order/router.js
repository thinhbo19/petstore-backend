const router = require("express").Router();
const {
  verifyAccessToken,
  isStrictAdmin,
} = require("../../middlewares/verifyToken");
const OrderControl = require("./controller");

router.post("/order", [verifyAccessToken], OrderControl.createOrder);
router.get("/", [verifyAccessToken, isStrictAdmin], OrderControl.getAllOrders);
router.get(
  "/totalPrice",
  [verifyAccessToken, isStrictAdmin],
  OrderControl.totalPriceOrder
);
router.get(
  "/most-purchased",
  [verifyAccessToken, isStrictAdmin],
  OrderControl.mostPurchasedProduct
);
router.get(
  "/most-users",
  [verifyAccessToken, isStrictAdmin],
  OrderControl.topUsersByOrders
);
router.get(
  "/total-sales-by-month/:year",
  [verifyAccessToken, isStrictAdmin],
  OrderControl.totalSalesByMonth
);
router.get("/:orderID", [verifyAccessToken, isStrictAdmin], OrderControl.getOneOrder);
router.get("/user/:userID", [verifyAccessToken], OrderControl.getUserOrder);
router.get("/userOne/:orderID", [verifyAccessToken], OrderControl.getOneOrderByUser);
router.patch(
  "/user/confirm-received/:orderID",
  [verifyAccessToken],
  OrderControl.confirmOrderReceivedByUser
);
router.patch(
  "/user/cancel/:orderID",
  [verifyAccessToken],
  OrderControl.cancelOrderByUser
);
router.post(
  "/user/after-sales/:orderID",
  [verifyAccessToken],
  OrderControl.requestAfterSalesByUser
);
router.get(
  "/after-sales",
  [verifyAccessToken, isStrictAdmin],
  OrderControl.getAfterSalesRequests
);
router.patch(
  "/after-sales/:orderID",
  [verifyAccessToken, isStrictAdmin],
  OrderControl.updateAfterSalesRequest
);

router.delete(
  "/:orderID",
  [verifyAccessToken, isStrictAdmin],
  OrderControl.deleteOrder
);
router.patch(
  "/update/:orderID",
  [verifyAccessToken, isStrictAdmin],
  OrderControl.updateStatusOrder
);
router.post("/createUrl", [verifyAccessToken], OrderControl.handlePaymentUrl);
router.get("/vnpay/vnpay_return", OrderControl.handleVnPayReturn);

router.post("/momopay", [verifyAccessToken], OrderControl.hanldMoMoPay);

module.exports = router;
