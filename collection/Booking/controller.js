const Booking = require("./model");
const User = require("../Users/model");
const TypeService = require("../TypeService/model");
const asyncHandler = require("express-async-handler");
const moment = require("moment");
const { createBookingOrderService } = require("../../service/bookingService");
const {
  getClientIp,
  buildVnPayPaymentUrl,
  verifyVnPayReturnQuery,
  buildCheckoutResultUrl,
  getSessionNotFoundRedirectUrl,
  failPaymentSessionAndBuildRedirect,
  succeedPaymentSessionAndBuildRedirect,
} = require("../../service/orderPaymentService");
const PaymentSession = require("../PaymentSession/model");
require("dotenv").config();

const MAX_BOOKINGS_PER_DAY = 30;
const MAX_BOOKINGS_PER_SLOT = 3;
const SLOT_TIMES = [
  "09:00",
  "10:00",
  "11:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
];

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const pad2 = (n) => String(n).padStart(2, "0");
const toVnDate = (date) => new Date(new Date(date).getTime() + VN_OFFSET_MS);
const vnDayKey = (date) => {
  const d = toVnDate(date);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
};
const vnTimeKey = (date) => {
  const d = toVnDate(date);
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
};
const parseMonth = (month) => {
  if (!month || typeof month !== "string") return null;
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const m = moment(`${month}-01`, "YYYY-MM-DD", true);
  return m.isValid() ? m : null;
};

async function assertBookingCapacityOrThrow(bookingDateRaw) {
  const raw = new Date(bookingDateRaw);
  if (Number.isNaN(raw.getTime())) {
    const err = new Error("Invalid bookingDate");
    err.statusCode = 400;
    throw err;
  }
  const dt = toVnDate(raw);

  const timeKey = `${pad2(dt.getUTCHours())}:${pad2(dt.getUTCMinutes())}`;
  if (!SLOT_TIMES.includes(timeKey)) {
    const err = new Error("Invalid time slot");
    err.statusCode = 400;
    throw err;
  }

  const y = dt.getUTCFullYear();
  const m = dt.getUTCMonth();
  const d = dt.getUTCDate();
  const hh = dt.getUTCHours();
  const mm = dt.getUTCMinutes();

  const startOfDay = new Date(Date.UTC(y, m, d, 0, 0, 0, 0) - VN_OFFSET_MS);
  const endOfDay = new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - VN_OFFSET_MS);
  const slotStart = new Date(Date.UTC(y, m, d, hh, mm, 0, 0) - VN_OFFSET_MS);
  const slotEnd = new Date(Date.UTC(y, m, d, hh, mm, 59, 999) - VN_OFFSET_MS);

  const dayCount = await Booking.countDocuments({
    bookingDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $ne: "Cancelled" },
  });
  if (dayCount >= MAX_BOOKINGS_PER_DAY) {
    const err = new Error("Day fully booked");
    err.statusCode = 409;
    throw err;
  }

  const slotCount = await Booking.countDocuments({
    bookingDate: { $gte: slotStart, $lte: slotEnd },
    status: { $ne: "Cancelled" },
  });
  if (slotCount >= MAX_BOOKINGS_PER_SLOT) {
    const err = new Error("Time slot fully booked");
    err.statusCode = 409;
    throw err;
  }
}

const getBookingAvailabilityByMonth = asyncHandler(async (req, res) => {
  const month = parseMonth(req.query?.month);
  if (!month) {
    return res.status(400).json({
      success: false,
      message: "month is required in YYYY-MM",
    });
  }

  const year = Number(month.format("YYYY"));
  const monthIndex = Number(month.format("MM")) - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0) - VN_OFFSET_MS);
  const end = new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0, 0) - VN_OFFSET_MS - 1);

  const list = await Booking.find({
    bookingDate: { $gte: start, $lte: end },
    status: { $ne: "Cancelled" },
  })
    .select("bookingDate status")
    .lean();

  const byDay = {};
  for (const b of list) {
    const dayKey = vnDayKey(b.bookingDate);
    const timeKey = vnTimeKey(b.bookingDate);
    if (!byDay[dayKey]) {
      byDay[dayKey] = { dayCount: 0, slots: {} };
    }
    byDay[dayKey].dayCount += 1;
    if (SLOT_TIMES.includes(timeKey)) {
      byDay[dayKey].slots[timeKey] = (byDay[dayKey].slots[timeKey] || 0) + 1;
    }
  }

  for (const dayKey of Object.keys(byDay)) {
    for (const t of SLOT_TIMES) {
      if (byDay[dayKey].slots[t] == null) byDay[dayKey].slots[t] = 0;
    }
  }

  return res.status(200).json({
    success: true,
    slots: SLOT_TIMES,
    limits: { perDay: MAX_BOOKINGS_PER_DAY, perSlot: MAX_BOOKINGS_PER_SLOT },
    days: byDay,
  });
});

const parseJsonField = (value, fallback) => {
  if (value == null || value === "") return fallback;
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return fallback;
};

const BOOKING_POPULATE = [
  { path: "user", select: "username email mobile" },
  { path: "services", select: "nameService type description price rating" },
  { path: "voucher" },
];

const applyBookingPopulate = (query) => {
  for (const populate of BOOKING_POPULATE) {
    query.populate(populate);
  }
  return query;
};
const sendBookingServerError = (res, message, error, includeError = true) =>
  res.status(500).json(
    includeError
      ? { success: false, message, error: error?.message }
      : { success: false, message },
  );

const createBooking = asyncHandler(async (req, res) => {
  try {
    let {
      user,
      petInfo,
      services,
      voucher,
      Note,
      bookingDate,
      totalPrice,
      paymentMethod,
    } = req.body;
    const requesterId = String(req.user?._id || "");
    const requesterRole = req.user?.role;

    services = parseJsonField(services, []);
    if (!Array.isArray(services) || !services.length) {
      return res.status(400).json({
        success: false,
        message: "At least one service is required",
      });
    }

    if (requesterRole !== "Admin" && requesterId !== String(user)) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to create booking for another user",
      });
    }

    try {
      await assertBookingCapacityOrThrow(bookingDate);
    } catch (e) {
      const code = Number(e?.statusCode) || 400;
      return res.status(code).json({
        success: false,
        message: e?.message || "Booking capacity exceeded",
      });
    }

    const newBooking = await Booking.create({
      user,
      petInfo,
      services,
      voucher: voucher || null,
      Note,
      bookingDate,
      totalPrice: Number(totalPrice),
      paymentMethod,
    });

    return res.status(201).json({
      success: true,
      message: "Booking created successfully",
      data: newBooking,
    });
  } catch (error) {
    return sendBookingServerError(res, "Failed to create booking", error, false);
  }
});

const getBookingById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await applyBookingPopulate(Booking.findById(id));

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    const requesterId = String(req.user?._id || "");
    if (
      req.user?.role !== "Admin" &&
      String(booking.user?._id || booking.user) !== requesterId
    ) {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }

    return res.status(200).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    return sendBookingServerError(res, "Failed to fetch booking", error);
  }
});

const getAllBookings = asyncHandler(async (req, res) => {
  try {
    const bookings = await applyBookingPopulate(Booking.find());

    return res.status(200).json({
      success: true,
      data: bookings,
    });
  } catch (error) {
    return sendBookingServerError(res, "Failed to fetch bookings", error);
  }
});

const getUserBooking = asyncHandler(async (req, res) => {
  const { userID } = req.params;
  const requesterId = String(req.user?._id || "");
  const requesterRole = req.user?.role;

  try {
    if (requesterRole !== "Admin" && requesterId !== String(userID)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }

    const orders = await applyBookingPopulate(Booking.find({ user: userID })).exec();
    if (!orders.length) {
      return res.status(404).json({
        success: false,
        message: "No order found",
      });
    }

    return res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    return sendBookingServerError(res, "Error retrieving orders", error);
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
    return sendBookingServerError(res, "Failed to update booking status", error);
  }
});

const deleteBooking = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const deletedBooking = await Booking.findByIdAndDelete(id);

    if (!deletedBooking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Booking deleted successfully",
    });
  } catch (error) {
    return sendBookingServerError(res, "Failed to delete booking", error);
  }
});

const handlePaymentUrl = asyncHandler(async (req, res) => {
  try {
    const {
      user,
      petInfo,
      services,
      voucher,
      Note,
      bookingDate,
      totalPrice,
      paymentMethod,
    } = req.body;
    const requesterId = String(req.user?._id || "");
    const requesterRole = req.user?.role;

    if (requesterRole !== "Admin" && requesterId !== String(user)) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to create payment URL for another user",
      });
    }

    const ipAddr = getClientIp(req);
    const { txnRef, paymentUrl } = buildVnPayPaymentUrl({
      amount: totalPrice,
      bankCode: req.body.bankCode || "",
      locale: req.body.language || "vn",
      ipAddr,
      returnUrl: process.env.VNP_RETURNURL_Booking,
    });

    await PaymentSession.create({
      txnRef,
      kind: "booking",
      payload: {
        user,
        petInfo,
        services,
        voucher: voucher || null,
        Note,
        status: "Processing",
        bookingDate,
        paymentMethod,
        totalPrice,
      },
    });

    return res.status(200).json({ success: true, paymentUrl });
  } catch (error) {
    return sendBookingServerError(res, "Error", error);
  }
});
const handleVnPayReturn = asyncHandler(async (req, res) => {
  try {
    const { isValid, txnRef, responseCode } = verifyVnPayReturnQuery(req.query);
    if (isValid) {
      const session = await PaymentSession.findOne({ txnRef, kind: "booking" });

      if (!session) {
        return res.redirect(getSessionNotFoundRedirectUrl("booking"));
      }

      if (session.status === "success" && session.redirectTo) {
        return res.redirect(session.redirectTo);
      }

      if (responseCode !== "00") {
        const redirectTo = await failPaymentSessionAndBuildRedirect({
          session,
          kind: "booking",
          reason: "payment_declined",
        });
        return res.redirect(redirectTo);
      }

      try {
        await assertBookingCapacityOrThrow(session?.payload?.bookingDate);
      } catch (e) {
        const redirectTo = await failPaymentSessionAndBuildRedirect({
          session,
          kind: "booking",
          reason: "slot_full",
        });
        return res.redirect(redirectTo);
      }

      const message = await createBookingOrderService({ ...session.payload });

      if (message) {
        const redirectTo = await succeedPaymentSessionAndBuildRedirect({
          session,
          kind: "booking",
          idKey: "bookingId",
          idValue: message._id,
        });
        return res.redirect(redirectTo);
      }

      return res.redirect(
        buildCheckoutResultUrl({
          kind: "booking",
          status: "failed",
          reason: "create_booking_failed",
        }),
      );
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Invalid signature" });
    }
  } catch (error) {
    return sendBookingServerError(res, "Server error", error);
  }
});

const totalPriceBooking = asyncHandler(async (req, res) => {
  try {
    const bookings = await Booking.find();

    if (!bookings || bookings.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No bookings found",
      });
    }

    const totalPrice = bookings.reduce((total, order) => {
      return total + (order.totalPrice || 0);
    }, 0);

    res.status(200).json({
      success: true,
      message: "Total price for all bookings calculated successfully",
      data: { totalPrice },
      totalPrice,
    });
  } catch (error) {
    return sendBookingServerError(
      res,
      "Error calculating total price for all bookings",
      error,
    );
  }
});

const mostPurchasedService = asyncHandler(async (req, res) => {
  try {
    const servicesAggregation = await Booking.aggregate([
      { $unwind: "$services" },

      {
        $group: {
          _id: "$services",
          totalPurchased: { $sum: 1 },
        },
      },
      { $sort: { totalPurchased: -1 } },
      { $limit: 7 },
    ]);
    if (servicesAggregation.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No services found in bookings.",
      });
    }

    const serviceIds = servicesAggregation.map((service) => service._id);
    const serviceDocuments = await TypeService.find({
      _id: { $in: serviceIds },
    }).select("nameService description");
    const serviceById = new Map(
      serviceDocuments.map((service) => [String(service._id), service]),
    );
    const servicesDetails = servicesAggregation.map((service) => {
      const details = serviceById.get(String(service._id));
      return {
        id: service._id,
        name: details?.nameService || "Unknown",
        totalPurchased: service.totalPurchased,
        description: details?.description || "",
      };
    });

    res.status(200).json({
      success: true,
      message: "Top 7 most purchased services fetched successfully",
      services: servicesDetails,
    });
  } catch (error) {
    return sendBookingServerError(res, "Error fetching most purchased services", error);
  }
});

const totalSalesByMonthBooking = asyncHandler(async (req, res) => {
  const { year } = req.params;

  try {
    const salesAggregation = await Booking.aggregate([
      {
        $match: { $expr: { $eq: [{ $year: "$bookingDate" }, parseInt(year)] } },
      },
      {
        $project: {
          totalPrice: 1,
          month: { $month: "$bookingDate" },
        },
      },
      {
        $group: {
          _id: "$month",
          totalSales: { $sum: "$totalPrice" },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    const monthlySales = Array.from({ length: 12 }, (_, i) => {
      const monthData = salesAggregation.find((sale) => sale._id === i + 1);
      return {
        month: i + 1,
        totalSales: monthData ? monthData.totalSales : 0,
      };
    });

    res.status(200).json({
      success: true,
      message: `Total sales by month for bookings in ${year} fetched successfully.`,
      data: monthlySales,
    });
  } catch (error) {
    return sendBookingServerError(
      res,
      "Error fetching total sales by month for bookings",
      error,
    );
  }
});
const topUsersByBooking = asyncHandler(async (req, res) => {
  try {
    const usersAggregation = await Booking.aggregate([
      {
        $group: {
          _id: "$user",
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { orderCount: -1 } },
      { $limit: 5 },
    ]);

    const userIds = usersAggregation.map((user) => user._id).filter(Boolean);
    const userDetails = await User.find({ _id: { $in: userIds } }).select(
      "username Avatar",
    );
    const userById = new Map(userDetails.map((user) => [String(user._id), user]));
    const topUsers = usersAggregation.map((user) => {
      const detail = userById.get(String(user._id));
      return {
        userId: user._id,
        name: detail?.username || "Unknown",
        Avatar: detail?.Avatar || "Unknown",
        orderCount: user.orderCount,
      };
    });

    res.status(200).json({
      success: true,
      message: "Top 5 users by booking count fetched successfully",
      data: topUsers,
    });
  } catch (error) {
    return sendBookingServerError(res, "Error fetching top users", error);
  }
});

module.exports = {
  createBooking,
  getBookingAvailabilityByMonth,
  getBookingById,
  getAllBookings,
  getUserBooking,
  updateBookingStatus,
  deleteBooking,
  handlePaymentUrl,
  handleVnPayReturn,
  totalPriceBooking,
  mostPurchasedService,
  totalSalesByMonthBooking,
  topUsersByBooking,
};
