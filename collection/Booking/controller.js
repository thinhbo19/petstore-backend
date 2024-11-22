const Booking = require("./model");
const TypeService = require("../TypeService/model");
const { default: mongoose } = require("mongoose");
const asyncHandler = require("express-async-handler");
const moment = require("moment");
const querystring = require("qs");
const crypto = require("crypto");
const { createBookingOrderService } = require("../../service/bookingService");
require("dotenv").config();

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

var inforOrder = {};

const createBooking = asyncHandler(async (req, res) => {
  try {
    const {
      user,
      pet,
      services,
      voucher,
      Note,
      bookingDate,
      totalPrice,
      paymentMethod,
    } = req.body;
    const images = req.files.map((file) => file.path);

    const newBooking = await Booking.create({
      user,
      pet: {
        ...pet,
        images,
      },
      services,
      voucher: voucher || null,
      Note,
      bookingDate,
      totalPrice,
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
      error: error.message,
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

  try {
    const orders = await Booking.find({ user: userID })
      .populate("user", "username email mobile")
      // .populate({
      //   path: "coupon",
      //   model: "Voucher",
      //   select: "nameVoucher",
      // })
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
      pet,
      services,
      voucher,
      Note,
      bookingDate,
      totalPrice,
      paymentMethod,
    } = req.body;
    const images = req.files.map((file) => file.path);

    inforOrder.user = user;
    inforOrder.pet = {
      ...pet,
      images,
    };
    inforOrder.services = services;
    inforOrder.voucher = voucher || null;
    inforOrder.note = Note;
    inforOrder.status = "Processing";
    inforOrder.bookingDate = bookingDate;
    inforOrder.paymentMethod = paymentMethod;
    inforOrder.totalPrice = totalPrice;

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
    let vnp_TxnRef = createDate;

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
      const message = await createBookingOrderService({
        ...inforOrder,
      });

      if (message) {
        return res.redirect(
          `${process.env.URL_CLIENT}/booking-detail/${message._id}`
        );
      } else {
        return res
          .status(400)
          .json({ success: false, message: "Booking order creation failed" });
      }
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
      { $limit: 1 },
    ]);

    if (servicesAggregation.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No services found in bookings.",
      });
    }

    const mostPurchased = servicesAggregation[0];
    const serviceDetails = await TypeService.findById(mostPurchased._id);

    res.status(200).json({
      success: true,
      message: "Most purchased service fetched successfully",
      service: {
        id: mostPurchased._id,
        name: serviceDetails.nameService,
        totalPurchased: mostPurchased.totalPurchased,
        description: serviceDetails.description,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching most purchased service",
      error: error.message,
    });
  }
});

const totalSalesByMonthBooking = asyncHandler(async (req, res) => {
  const { year } = req.params;

  try {
    const salesAggregation = await Booking.aggregate([
      {
        $match: { $expr: { $eq: [{ $year: "$realDate" }, parseInt(year)] } },
      },
      {
        $project: {
          totalPrice: 1,
          month: { $month: "$realDate" },
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

module.exports = {
  createBooking,
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
};
