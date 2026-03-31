const Booking = require("./model");
const User = require("../Users/model");
const TypeService = require("../TypeService/model");
const { default: mongoose } = require("mongoose");
const asyncHandler = require("express-async-handler");
const moment = require("moment");
const querystring = require("qs");
const crypto = require("crypto");
const { createBookingOrderService } = require("../../service/bookingService");
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

  // dt is VN clock represented in UTC getters. Convert VN boundaries back to UTC.
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

  // month from FE is VN month (YYYY-MM), query in UTC range
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

function sortObject(obj) {
  let sorted = {};
  let str = [];
  let key;
  for (key in obj) {
    if (obj.hasOwnProperty(key)) {
      str.push(encodeURIComponent(key));
    }
  }
  str.sort();
  for (key = 0; key < str.length; key++) {
    sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, "+");
  }
  return sorted;
}

const buildTxnRef = () =>
  `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

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
    return res.status(500).json({
      success: false,
      message: "Failed to create booking",
    });
  }
});

const getBookingById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await Booking.findById(id)
      .populate("user", "username email mobile")
      .populate({
        path: "services",
        select: "nameService type description price rating",
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
      .populate("user", "username email mobile")
      .populate({
        path: "services",
        select: "nameService type description price rating",
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

    const orders = await Booking.find({ user: userID })
      .populate("user", "username email mobile")
      .populate({
        path: "services",
        select: "nameService type description price rating",
      })
      .exec();

    if (!orders) {
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
    return res.status(500).json({
      success: false,
      message: "Error retrieving orders",
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
    return res.status(500).json({
      success: false,
      message: "Failed to delete booking",
      error: error.message,
    });
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

    var ipAddr =
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      req.connection.socket.remoteAddress;

    var tmnCode = process.env.VNP_TMNCODE;
    var secretKey = process.env.VNP_HASHSECRET;
    var vnpUrl = process.env.VNP_URL;
    var returnUrl = process.env.VNP_RETURNURL_Booking;

    var date = new Date();

    var createDate = moment(date).format("YYYYMMDDHHmmss");
    const amount = totalPrice;
    var bankCode = req.body.bankCode || "";
    let vnp_TxnRef = buildTxnRef();

    const locale = req.body.language || "vn";

    var currCode = "VND";
    var vnp_Params = {};
    vnp_Params["vnp_Version"] = "2.1.0";
    vnp_Params["vnp_Command"] = "pay";
    vnp_Params["vnp_TmnCode"] = tmnCode;
    vnp_Params["vnp_Locale"] = locale;
    vnp_Params["vnp_CurrCode"] = currCode;
    vnp_Params["vnp_TxnRef"] = vnp_TxnRef;
    vnp_Params["vnp_OrderInfo"] = "Thanh toan cho ma GD:" + vnp_TxnRef;
    vnp_Params["vnp_OrderType"] = "other";
    vnp_Params["vnp_Amount"] = amount * 100;
    vnp_Params["vnp_ReturnUrl"] = returnUrl;
    vnp_Params["vnp_IpAddr"] = ipAddr;
    vnp_Params["vnp_CreateDate"] = createDate;
    if (bankCode !== null && bankCode !== "") {
      vnp_Params["vnp_BankCode"] = bankCode;
    }

    const sortedParams = sortObject(vnp_Params);

    const signData = querystring.stringify(sortedParams, { encode: false });
    const hmac = crypto.createHmac("sha512", secretKey);
    const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");
    sortedParams["vnp_SecureHash"] = signed;

    const paymentUrl =
      vnpUrl + "?" + querystring.stringify(sortedParams, { encode: false });

    await PaymentSession.create({
      txnRef: vnp_TxnRef,
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
    return res.status(500).json({
      success: false,
      message: "Error",
      error: error.message,
    });
  }
});
const handleVnPayReturn = asyncHandler(async (req, res) => {
  try {
    let vnp_Params = req.query;
    let secureHash = vnp_Params["vnp_SecureHash"];

    delete vnp_Params["vnp_SecureHash"];
    delete vnp_Params["vnp_SecureHashType"];

    vnp_Params = sortObject(vnp_Params);
    const secretKey = process.env.VNP_HASHSECRET;
    const signData = querystring.stringify(vnp_Params, { encode: false });
    const hmac = crypto.createHmac("sha512", secretKey);
    const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

    if (secureHash === signed) {
      const txnRef = vnp_Params["vnp_TxnRef"];
      const responseCode = String(req.query?.vnp_ResponseCode || "");
      const session = await PaymentSession.findOne({ txnRef, kind: "booking" });

      if (!session) {
        return res.redirect(
          `${process.env.URL_CLIENT}/checkout/result?kind=booking&status=failed&reason=session_not_found`,
        );
      }

      if (session.status === "success" && session.redirectTo) {
        return res.redirect(session.redirectTo);
      }

      if (responseCode !== "00") {
        session.status = "failed";
        session.redirectTo = `${process.env.URL_CLIENT}/checkout/result?kind=booking&status=failed&reason=payment_declined`;
        session.consumedAt = new Date();
        await session.save();
        return res.redirect(session.redirectTo);
      }

      try {
        await assertBookingCapacityOrThrow(session?.payload?.bookingDate);
      } catch (e) {
        session.status = "failed";
        session.redirectTo = `${process.env.URL_CLIENT}/checkout/result?kind=booking&status=failed&reason=slot_full`;
        session.consumedAt = new Date();
        await session.save();
        return res.redirect(session.redirectTo);
      }

      const message = await createBookingOrderService({ ...session.payload });

      if (message) {
        session.status = "success";
        session.consumedAt = new Date();
        session.redirectTo = `${process.env.URL_CLIENT}/checkout/result?kind=booking&status=success&bookingId=${message._id}`;
        await session.save();
        return res.redirect(session.redirectTo);
      }

      return res.redirect(
        `${process.env.URL_CLIENT}/checkout/result?kind=booking&status=failed&reason=create_booking_failed`,
      );
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Invalid signature" });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
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
      totalPrice,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error calculating total price for all bookings",
      error: error.message,
    });
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

    const servicesDetails = await Promise.all(
      servicesAggregation.map(async (service) => {
        const details = await TypeService.findById(service._id);
        console.log(details);

        return {
          id: service._id,
          name: details.nameService,
          totalPurchased: service.totalPurchased,
          description: details.description,
        };
      })
    );

    res.status(200).json({
      success: true,
      message: "Top 7 most purchased services fetched successfully",
      services: servicesDetails,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching most purchased services",
      error: error.message,
    });
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
    res.status(500).json({
      success: false,
      message: "Error fetching total sales by month for bookings",
      error: error.message,
    });
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

    const topUsers = await Promise.all(
      usersAggregation.map(async (user) => {
        const userDetails = await User.findById(user._id).select(
          "username Avatar"
        );
        return {
          userId: user._id,
          name: userDetails?.username || "Unknown",
          Avatar: userDetails?.Avatar || "Unknown",
          orderCount: user.orderCount,
        };
      })
    );

    res.status(200).json({
      success: true,
      message: "Top 5 users by booking count fetched successfully",
      data: topUsers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching top users",
      error: error.message,
    });
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
