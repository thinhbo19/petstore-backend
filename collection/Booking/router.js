const router = require("express").Router();
const { verifyAccessToken, isAdmin } = require("../../middlewares/verifyToken");
const BookingControll = require("./controller");
const uploadCloud = require("../../middlewares/uploadimg");

router.post("/", uploadCloud.array("images"), BookingControll.createBooking);
router.get("/", BookingControll.getAllBookings);
router.get(
  "/totalPrice",
  [verifyAccessToken, isAdmin],
  BookingControll.totalPriceBooking
);
router.get(
  "/most-purchased",
  [verifyAccessToken, isAdmin],
  BookingControll.mostPurchasedService
);
router.get(
  "/total-sales-by-month/:year",
  [verifyAccessToken, isAdmin],
  BookingControll.totalSalesByMonthBooking
);
router.get(
  "/most-users",
  [verifyAccessToken, isAdmin],
  BookingControll.topUsersByBooking
);
router.get("/:id", [verifyAccessToken], BookingControll.getBookingById);
router.get(
  "/user/:userID",
  [verifyAccessToken],
  BookingControll.getUserBooking
);
router.put("/status/:id", BookingControll.updateBookingStatus);
router.delete(
  "/:id",
  [verifyAccessToken, isAdmin],
  BookingControll.deleteBooking
);

router.post(
  "/createUrl",
  uploadCloud.array("images"),
  BookingControll.handlePaymentUrl
);
router.get("/vnpay/vnpay_return", BookingControll.handleVnPayReturn);

module.exports = router;
