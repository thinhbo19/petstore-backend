const router = require("express").Router();
const {
  verifyAccessToken,
  isAdmin,
  isStrictAdmin,
} = require("../../middlewares/verifyToken");
const BookingControll = require("./controller");
const uploadCloud = require("../../middlewares/uploadimg");

router.post("/", [verifyAccessToken], uploadCloud.array("images"), BookingControll.createBooking);
router.get("/", [verifyAccessToken, isAdmin], BookingControll.getAllBookings);
router.get(
  "/totalPrice",
  [verifyAccessToken, isStrictAdmin],
  BookingControll.totalPriceBooking
);
router.get(
  "/most-purchased",
  [verifyAccessToken, isStrictAdmin],
  BookingControll.mostPurchasedService
);
router.get(
  "/total-sales-by-month/:year",
  [verifyAccessToken, isStrictAdmin],
  BookingControll.totalSalesByMonthBooking
);
router.get(
  "/most-users",
  [verifyAccessToken, isStrictAdmin],
  BookingControll.topUsersByBooking
);
router.get("/:id", [verifyAccessToken], BookingControll.getBookingById);
router.get(
  "/user/:userID",
  [verifyAccessToken],
  BookingControll.getUserBooking
);
router.put("/status/:id", [verifyAccessToken, isAdmin], BookingControll.updateBookingStatus);
router.delete(
  "/:id",
  [verifyAccessToken, isStrictAdmin],
  BookingControll.deleteBooking
);

router.post(
  "/createUrl",
  [verifyAccessToken],
  uploadCloud.array("images"),
  BookingControll.handlePaymentUrl
);
router.get("/vnpay/vnpay_return", BookingControll.handleVnPayReturn);

module.exports = router;
