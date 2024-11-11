const router = require("express").Router();
const { verifyAccessToken, isAdmin } = require("../../middlewares/verifyToken");
const BookingControll = require("./controller");
const uploadCloud = require("../../middlewares/uploadimg");

router.post("/", uploadCloud.array("images"), BookingControll.createBooking);
router.get("/", BookingControll.getAllBookings);
router.get("/:id", BookingControll.getBookingById);
router.put("/status/:id", BookingControll.updateBookingStatus);
router.delete(
  "/:id",
  [verifyAccessToken, isAdmin],
  BookingControll.deleteBooking
);

router.post("/createUrl", BookingControll.handlePaymentUrl);
router.get("/vnpay/vnpay_return", BookingControll.handleVnPayReturn);

module.exports = router;
