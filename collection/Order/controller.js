const Order = require("./model");
const User = require("../Users/model");
const Voucher = require("../Voucher/model");
const PaymentSession = require("../PaymentSession/model");
const orderService = require("../../service/orderService");
const orderPaymentService = require("../../service/orderPaymentService");
const orderFinalizeService = require("../../service/orderFinalizeService");
const asyncHandler = require("express-async-handler");
const crypto = require("crypto");
const { enrichOrderDoc } = require("../../utils/enrichOrderProducts");
require("dotenv").config();

function mapOrderItemErrorToHttp(calcErr) {
  const message = calcErr?.message || "Invalid order items";
  const status = message.includes("not found") ? 404 : 400;
  return { status, message };
}

function sendServerError(res, error, message = "Server error") {
  return res.status(500).json({
    success: false,
    message,
    error: error?.message,
  });
}

function buildOrderPopulateQuery(query) {
  return query
    .populate("OrderBy", "username email mobile")
    .populate({
      path: "coupon",
      model: "Voucher",
      select: "nameVoucher",
    });
}

async function findOrderByIdWithRelations(orderID) {
  return buildOrderPopulateQuery(Order.findById(orderID)).exec();
}

async function findOrdersByUserWithRelations(userID) {
  return buildOrderPopulateQuery(Order.find({ OrderBy: userID })).exec();
}

async function applyCouponDiscountForUser({ orderBy, coupon, totalPrice }) {
  if (!coupon) return { totalPrice, error: null, status: 200 };

  const userForCoupon = await User.findById(orderBy).populate("Voucher.voucherID");
  const userVouchers = (userForCoupon?.Voucher || []).map((v) => v.voucherID);
  const matchedUserVoucher = userVouchers.find((v) => v?._id?.equals(coupon));

  if (!matchedUserVoucher) {
    return {
      totalPrice,
      error: "Coupon not valid for this user",
      status: 400,
    };
  }

  const voucherDoc = await Voucher.findById(coupon);
  if (!voucherDoc) {
    return {
      totalPrice,
      error: "Coupon not found",
      status: 404,
    };
  }

  const discountAmount = (totalPrice * voucherDoc.discount) / 100;
  return {
    totalPrice: Math.max(0, totalPrice - discountAmount),
    error: null,
    status: 200,
  };
}

const createOrder = asyncHandler(async (req, res) => {
  try {
    const {
      products,
      paymentMethod,
      coupon,
      address,
      note,
      orderBy,
      receiverName,
      receiverPhone,
    } =
      req.body;
    const requesterId = String(req.user?._id || "");
    const requesterRole = req.user?.role;

    if (!products || !address || !orderBy) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    if (requesterRole !== "Admin" && requesterId !== String(orderBy)) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to create order for another user",
      });
    }

    const { error: lineErr, normalized: lineItems } =
      orderService.normalizeOrderLineItems(products);
    if (lineErr) {
      return res.status(400).json({
        success: false,
        message: lineErr,
      });
    }

    let totalPrice = 0;
    try {
      totalPrice = await orderService.returnTotalPrice({ products: lineItems });
    } catch (calcErr) {
      const { status, message } = mapOrderItemErrorToHttp(calcErr);
      return res.status(status).json({ success: false, message });
    }

    const couponResult = await applyCouponDiscountForUser({
      orderBy,
      coupon,
      totalPrice,
    });
    if (couponResult.error) {
      return res
        .status(couponResult.status)
        .json({ success: false, message: couponResult.error });
    }
    totalPrice = couponResult.totalPrice;

    const newOrder = await Order.create({
      products: lineItems,
      totalPrice,
      paymentMethod,
      coupon: coupon || null,
      address,
      receiverName: receiverName || "",
      receiverPhone: receiverPhone || "",
      Note: note || "",
      OrderBy: orderBy,
      status: "Processing",
    });

    if (!newOrder) {
      return res.status(500).json({
        success: false,
        message: "Failed to create order",
      });
    }

    try {
      await orderFinalizeService.decreaseInventoryByLineItems(lineItems);
      await orderFinalizeService.decreaseUserCartQuantities({ userId: orderBy, lineItems });
    } catch (invErr) {
      await Order.findByIdAndDelete(newOrder._id);
      console.error("createOrder finalize error:", invErr?.message || invErr);
      return res.status(500).json({
        success: false,
        message:
          "Không thể hoàn tất đơn hàng (cập nhật kho hoặc giỏ). Đơn tạm đã được hủy.",
      });
    }

    const user = await User.findById(orderBy);
    await orderFinalizeService.sendOrderConfirmationEmailSafe({ user, order: newOrder });

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: newOrder,
    });
  } catch (error) {
    console.error("createOrder error:", error?.message || error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});
const getAllOrders = asyncHandler(async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("OrderBy", "username email mobile")
      .exec();

    if (!orders) {
      return res.status(404).json({
        success: false,
        message: "No orders found",
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
const deleteOrder = asyncHandler(async (req, res) => {
  const { orderID } = req.params;

  try {
    const order = await Order.findByIdAndDelete(orderID);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error deleting order",
      error: error.message,
    });
  }
});
const getOneOrder = asyncHandler(async (req, res) => {
  const { orderID } = req.params;

  try {
    const orders = await findOrderByIdWithRelations(orderID);

    if (!orders) {
      return res.status(404).json({
        success: false,
        message: "No order found",
      });
    }

    const data = await enrichOrderDoc(orders);
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error retrieving orders",
      error: error.message,
    });
  }
});
const getUserOrder = asyncHandler(async (req, res) => {
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

    const orders = await findOrdersByUserWithRelations(userID);

    if (!orders) {
      return res.status(404).json({
        success: false,
        message: "No order found",
      });
    }

    const viewerForRating =
      requesterRole === "Admin" ? String(userID) : requesterId;
    const data = await Promise.all(
      orders.map((o) => enrichOrderDoc(o, { viewerId: viewerForRating })),
    );
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error retrieving orders",
      error: error.message,
    });
  }
});
const updateStatusOrder = asyncHandler(async (req, res) => {
  const { orderID } = req.params;
  const { status } = req.body;
  const response = await Order.findByIdAndUpdate(
    orderID,
    { status },
    { new: true }
  );
  return res.json({
    success: response ? true : false,
    response: response ? response : "false",
  });
});

/** Khách xác nhận đã nhận hàng: chỉ Shipping → Success, chỉ chủ đơn. */
const confirmOrderReceivedByUser = asyncHandler(async (req, res) => {
  const { orderID } = req.params;
  const requesterId = String(req.user?._id || "");

  const order = await Order.findById(orderID);
  if (!order) {
    return res.status(404).json({
      success: false,
      message: "No order found",
    });
  }

  if (String(order.OrderBy) !== requesterId) {
    return res.status(403).json({
      success: false,
      message: "Forbidden",
    });
  }

  if (order.status !== "Shipping") {
    return res.status(400).json({
      success: false,
      message: "Chỉ đơn đang giao mới xác nhận nhận hàng được",
    });
  }

  order.status = "Success";
  await order.save();
  const data = await enrichOrderDoc(order, { viewerId: requesterId });
  return res.status(200).json({
    success: true,
    message: "Đã xác nhận nhận hàng",
    data,
  });
});

/** Khách hủy đơn: chỉ Processing → Cancelled, chỉ chủ đơn; hoàn trả số lượng kho. */
const cancelOrderByUser = asyncHandler(async (req, res) => {
  const { orderID } = req.params;
  const requesterId = String(req.user?._id || "");

  const order = await Order.findById(orderID);
  if (!order) {
    return res.status(404).json({
      success: false,
      message: "No order found",
    });
  }

  if (String(order.OrderBy) !== requesterId) {
    return res.status(403).json({
      success: false,
      message: "Forbidden",
    });
  }

  if (order.status !== "Processing") {
    return res.status(400).json({
      success: false,
      message: "Chỉ đơn đang xử lý mới được hủy",
    });
  }

  const products = (order.products || []).filter((item) => item?.id && item?.count);
  await orderFinalizeService.increaseInventoryByLineItems(products);

  order.status = "Cancelled";
  await order.save();
  const data = await enrichOrderDoc(order, { viewerId: requesterId });
  return res.status(200).json({
    success: true,
    message: "Đã hủy đơn hàng",
    data,
  });
});

const getOneOrderByUser = asyncHandler(async (req, res) => {
  const { orderID } = req.params;
  const requesterId = String(req.user?._id || "");
  const requesterRole = req.user?.role;

  try {
    const order = await findOrderByIdWithRelations(orderID);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "No order found",
      });
    }

    if (
      requesterRole !== "Admin" &&
      String(order.OrderBy?._id || order.OrderBy) !== requesterId
    ) {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }

    const viewerForRating =
      requesterRole === "Admin" ? undefined : requesterId;
    const data = await enrichOrderDoc(order, { viewerId: viewerForRating });
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error retrieving order",
      error: error.message,
    });
  }
});

const requestAfterSalesByUser = asyncHandler(async (req, res) => {
  const { orderID } = req.params;
  const requesterId = String(req.user?._id || "");
  const { type, reason } = req.body || {};

  if (!["Return", "Refund", "Complaint"].includes(type)) {
    return res.status(400).json({ success: false, message: "Invalid after-sales type" });
  }
  if (!reason || String(reason).trim().length < 5) {
    return res.status(400).json({ success: false, message: "Reason is required" });
  }

  const order = await Order.findById(orderID);
  if (!order) return res.status(404).json({ success: false, message: "No order found" });
  if (String(order.OrderBy) !== requesterId) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }
  if (order.status !== "Success") {
    return res
      .status(400)
      .json({ success: false, message: "Only completed orders can request after-sales" });
  }

  order.afterSales = {
    requested: true,
    type,
    reason: String(reason).trim(),
    status: "Pending",
    note: "",
    requestedAt: new Date(),
    updatedAt: new Date(),
  };
  await order.save();

  return res.status(200).json({
    success: true,
    message: "After-sales request submitted",
    data: order,
  });
});

const getAfterSalesRequests = asyncHandler(async (_req, res) => {
  const requests = await Order.find({ "afterSales.requested": true })
    .sort({ "afterSales.requestedAt": -1 })
    .populate("OrderBy", "username email");
  return res.status(200).json({ success: true, data: requests });
});

const updateAfterSalesRequest = asyncHandler(async (req, res) => {
  const { orderID } = req.params;
  const { status, note } = req.body || {};
  if (!["Approved", "Rejected", "Pending"].includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid after-sales status" });
  }
  const order = await Order.findById(orderID);
  if (!order || !order.afterSales?.requested) {
    return res.status(404).json({ success: false, message: "After-sales request not found" });
  }
  order.afterSales.status = status;
  order.afterSales.note = note || "";
  order.afterSales.updatedAt = new Date();
  await order.save();
  return res.status(200).json({ success: true, message: "After-sales updated", data: order });
});
const handlePaymentUrl = asyncHandler(async (req, res) => {
  try {
    const {
      orderBy,
      products,
      coupon,
      note,
      address,
      paymentMethod,
      receiverName,
      receiverPhone,
    } =
      req.body;
    const requesterId = String(req.user?._id || "");
    const requesterRole = req.user?.role;

    if (requesterRole !== "Admin" && requesterId !== String(orderBy)) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to create payment URL for another user",
      });
    }

    const { error: payLineErr, normalized: payLineItems } =
      orderService.normalizeOrderLineItems(products);
    if (payLineErr) {
      return res.status(400).json({
        success: false,
        message: payLineErr,
      });
    }

    const priceTotal = await orderService.returnTotalPrice({
      products: payLineItems,
    });

    const { txnRef, paymentUrl } = orderPaymentService.buildVnPayPaymentUrl({
      amount: priceTotal,
      bankCode: req.body.bankCode || "",
      locale: req.body.language || "vn",
      ipAddr: orderPaymentService.getClientIp(req),
    });

    await PaymentSession.create({
      txnRef,
      kind: "order",
      payload: {
        orderBy,
        coupon: coupon || null,
        note: note || "",
        address,
        receiverName: receiverName || "",
        receiverPhone: receiverPhone || "",
        status: "Processing",
        paymentMethod,
        totalPrice: priceTotal,
        products: payLineItems,
      },
    });

    return res.status(200).json({ success: true, paymentUrl });
  } catch (error) {
    return sendServerError(res, error, "Error");
  }
});
const handleVnPayReturn = asyncHandler(async (req, res) => {
  try {
    const { isValid, txnRef, responseCode } =
      orderPaymentService.verifyVnPayReturnQuery(req.query);

    if (isValid) {
      const session = await PaymentSession.findOne({ txnRef, kind: "order" });

      if (!session) {
        return res.redirect(
          `${process.env.URL_CLIENT}/checkout/result?kind=order&status=failed&reason=session_not_found`,
        );
      }

      if (session.status === "success" && session.redirectTo) {
        return res.redirect(session.redirectTo);
      }

      if (responseCode !== "00") {
        session.status = "failed";
        session.redirectTo = `${process.env.URL_CLIENT}/checkout/result?kind=order&status=failed&reason=payment_declined`;
        session.consumedAt = new Date();
        await session.save();
        return res.redirect(session.redirectTo);
      }

      const message = await orderService.createOrderService({
        ...session.payload,
      });

      if (message) {
        const userId = message.OrderBy;
        const user = await orderFinalizeService.removeExactPurchasedItemsFromCart({
          userId,
          purchasedProducts: message.products || [],
        });
        await orderFinalizeService.sendOrderConfirmationEmailSafe({ user, order: message });

        session.status = "success";
        session.consumedAt = new Date();
        session.redirectTo = `${process.env.URL_CLIENT}/checkout/result?kind=order&status=success&orderId=${message._id}`;
        await session.save();
        return res.redirect(session.redirectTo);
      }

      return res.redirect(
        `${process.env.URL_CLIENT}/checkout/result?kind=order&status=failed&reason=create_order_failed`,
      );
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Invalid signature" });
    }
  } catch (error) {
    return sendServerError(res, error, "Server error");
  }
});
const handleMoMoPay = asyncHandler(async (req, res) => {
  try {
    const partnerCode = process.env.MOMO_PARTNER_CODE;
    const accessKey = process.env.MOMO_ACCESS_KEY;
    const secretKey = process.env.MOMO_SECRET_KEY;
    const redirectUrl = process.env.MOMO_REDIRECT_URL;
    const returnUrl = process.env.MOMOPAY_RETURNURL;

    const orderId = new Date().getTime();
    const requestId = partnerCode + orderId;
    const amount = "5000";
    const orderInfo = "Thanh Toán Qua Ví MOMO";
    const extraData = "";

    const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${returnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=captureWallet`;

    const signature = crypto
      .createHmac("sha256", secretKey)
      .update(rawSignature)
      .digest("hex");

    const requestBody = JSON.stringify({
      partnerCode,
      accessKey,
      requestId,
      amount,
      orderId,
      orderInfo,
      redirectUrl,
      ipnUrl: returnUrl,
      extraData,
      requestType: "captureWallet",
      signature,
      lang: "en",
    });

    const response = await fetch(
      "https://test-payment.momo.vn/v2/gateway/api/create",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: requestBody,
      }
    );

    const data = await response.json();

    if (data && data.payUrl) {
      return res.status(200).json({ success: true, payUrl: data.payUrl });
    } else {
      return res
        .status(500)
        .json({ success: false, message: "Failed to create MoMo payment URL" });
    }
  } catch (error) {
    return sendServerError(res, error, "Server error");
  }
});
const totalPriceOrder = asyncHandler(async (req, res) => {
  try {
    const orders = await Order.find();

    if (!orders || orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No orders found",
      });
    }

    const totalPrice = orders.reduce((total, order) => {
      return total + (order.totalPrice || 0);
    }, 0);

    res.status(200).json({
      success: true,
      message: "Total price for all orders calculated successfully",
      totalPrice,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error calculating total price for all orders",
      error: error.message,
    });
  }
});
const mostPurchasedProduct = asyncHandler(async (req, res) => {
  try {
    const productsAggregation = await Order.aggregate([
      { $unwind: "$products" },

      {
        $group: {
          _id: "$products.id",
          totalPurchased: { $sum: "$products.count" },
          productName: { $first: "$products.name" },
          prodImg: { $first: "$products.img" },
        },
      },
      { $sort: { totalPurchased: -1 } },
      { $limit: 7 },
    ]);

    if (productsAggregation.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No products found in orders within the last 7 days.",
      });
    }

    const topProducts = productsAggregation.map((product) => ({
      id: product._id,
      name: product.productName,
      totalPurchased: product.totalPurchased,
      img: product.prodImg,
    }));

    res.status(200).json({
      success: true,
      message: "Top purchased products in the last 7 days fetched successfully",
      products: topProducts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching top purchased products",
      error: error.message,
    });
  }
});

const totalSalesByMonth = asyncHandler(async (req, res) => {
  try {
    const { year } = req.params;
    const selectedYear = parseInt(year, 10);

    const salesAggregation = await Order.aggregate([
      {
        $project: {
          totalPrice: 1,
          month: { $month: "$createdAt" },
          year: { $year: "$createdAt" },
        },
      },
      {
        $match: { year: selectedYear },
      },
      {
        $group: {
          _id: { month: "$month" },
          totalSales: { $sum: "$totalPrice" },
        },
      },
      {
        $sort: { "_id.month": 1 },
      },
    ]);

    const monthlySales = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      totalSales: 0,
    }));

    salesAggregation.forEach((sale) => {
      const monthIndex = sale._id.month - 1;
      monthlySales[monthIndex].totalSales = sale.totalSales;
    });

    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const formattedData = monthlySales.map((data, index) => ({
      month: monthNames[index],
      totalSales: data.totalSales,
    }));

    res.status(200).json({
      success: true,
      message: "Total sales by month fetched successfully",
      data: formattedData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching total sales by month",
      error: error.message,
    });
  }
});

const topUsersByOrders = asyncHandler(async (req, res) => {
  try {
    const usersAggregation = await Order.aggregate([
      {
        $group: {
          _id: "$OrderBy",
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
      message: "Top 5 users by order count fetched successfully",
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
  createOrder,
  getAllOrders,
  getOneOrder,
  getUserOrder,
  getOneOrderByUser,
  deleteOrder,
  updateStatusOrder,
  confirmOrderReceivedByUser,
  cancelOrderByUser,
  requestAfterSalesByUser,
  getAfterSalesRequests,
  updateAfterSalesRequest,
  handlePaymentUrl,
  handleVnPayReturn,
  handleMoMoPay,
  hanldMoMoPay: handleMoMoPay,
  totalPriceOrder,
  mostPurchasedProduct,
  topUsersByOrders,
  totalSalesByMonth,
};
