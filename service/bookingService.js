const Booking = require("../collection/Booking/model");
const User = require("../collection/Users/model");
const Voucher = require("../collection/Voucher/model");

const createBookingOrderService = async ({
  user,
  pet,
  services,
  voucher,
  Note,
  bookingDate,
  totalPrice,
  paymentMethod,
}) => {
  try {
    const newOrder = await Booking.create({
      user,
      pet,
      services,
      voucher,
      Note,
      bookingDate,
      totalPrice,
      paymentMethod,
    });

    if (!newOrder) {
      throw new Error("Failed to create order");
    }

    return newOrder;
  } catch (error) {
    throw new Error(error.message);
  }
};

module.exports = {
  createBookingOrderService,
};
