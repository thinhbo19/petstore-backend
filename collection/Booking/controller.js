const Booking = require("./model");
const { default: mongoose } = require("mongoose");
const asyncHandler = require("express-async-handler");

const createBooking = asyncHandler(async (req, res) => {
  try {
    const { user, pet, services, voucher, Note, bookingDate, totalPrice } =
      req.body;

    const newBooking = await Booking.create({
      user,
      pet,
      services,
      voucher,
      Note,
      bookingDate,
      totalPrice,
    });

    return res.status(201).json({
      success: true,
      message: "Booking created successfully",
      data: newBooking,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create booking",
      error: error.message,
    });
  }
});

const getBookingById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await Booking.findById(id)
      .populate("user", "username email")
      .populate({
        path: "services",
        select: "nameService type description price",
      })
      .populate({
        path: "voucher",
      });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch booking",
      error: error.message,
    });
  }
});

const getAllBookings = asyncHandler(async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate("user", "name email")
      .populate({
        path: "services",
        select: "nameService type description price",
      })
      .populate({
        path: "voucher",
      });

    return res.status(200).json({
      success: true,
      data: bookings,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch bookings",
      error: error.message,
    });
  }
});

const updateBookingStatus = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const updatedBooking = await Booking.findByIdAndUpdate(
      id,
      { status: status },
      { new: true }
    );

    if (!updatedBooking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Booking status updated successfully",
      data: updatedBooking,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update booking status",
      error: error.message,
    });
  }
});

module.exports = {
  createBooking,
  getBookingById,
  getAllBookings,
  updateBookingStatus,
};
