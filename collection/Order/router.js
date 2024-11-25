const router = require("express").Router();
const { verifyAccessToken, isAdmin } = require("../../middlewares/verifyToken");
const OrderControl = require("./controller");

router.post("/order", OrderControl.createOrder);
router.get("/", [verifyAccessToken], OrderControl.getAllOrders);
router.get(
  "/totalPrice",
  [verifyAccessToken, isAdmin],
  OrderControl.totalPriceOrder
);
router.get(
  "/most-purchased",
  [verifyAccessToken, isAdmin],
  OrderControl.mostPurchasedProduct
);
router.get(
  "/most-users",
  [verifyAccessToken, isAdmin],
  OrderControl.topUsersByOrders
);
router.get(
  "/total-sales-by-month/:year",
  [verifyAccessToken, isAdmin],
  OrderControl.totalSalesByMonth
);
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
router.get("/vnpay/vnpay_return", OrderControl.handleVnPayReturn);

router.post("/momopay", OrderControl.hanldMoMoPay);

module.exports = router;
