const router = require("express").Router();
const { verifyAccessToken, isAdmin } = require("../../middlewares/verifyToken");
const BookingControll = require("./controller");

router.post("/", BookingControll.createBooking);
router.get("/", BookingControll.getAllBookings);
router.get("/:id", BookingControll.getBookingById);
router.put("/status/:id", BookingControll.updateBookingStatus);

module.exports = router;
