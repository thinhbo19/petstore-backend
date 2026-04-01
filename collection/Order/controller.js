const Order = require("./model");
const User = require("../Users/model");
const PaymentSession = require("../PaymentSession/model");
const orderService = require("../../service/orderService");
const orderPaymentService = require("../../service/orderPaymentService");
const orderFinalizeService = require("../../service/orderFinalizeService");
const orderStatsService = require("../../service/orderStatsService");
const orderReadService = require("../../service/orderReadService");
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

function sendStatsError(res, error, message) {
  return sendServerError(res, error, message);
}
function sendOrderReadError(res, error, message) {
  return sendServerError(res, error, message);
}
const findOwnedOrder = async (orderID, requesterId) => {
  const order = await Order.findById(orderID);
  if (!order) {
    return { error: { status: 404, message: "No order found" }, order: null };
  }
  if (String(order.OrderBy) !== requesterId) {
    return { error: { status: 403, message: "Forbidden" }, order: null };
  }
  return { error: null, order };
};

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

    const couponResult = await orderService.applyCouponForUser({
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
    const orders = await orderReadService.getAllOrdersWithUser();

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
    return sendOrderReadError(res, error, "Error retrieving orders");
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
    const orders = await orderReadService.getOrderByIdWithRelations(orderID);

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
    return sendOrderReadError(res, error, "Error retrieving orders");
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

    const orders = await orderReadService.getOrdersByUserWithRelations(userID);

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
    return sendOrderReadError(res, error, "Error retrieving orders");
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

  const { error: ownedErr, order } = await findOwnedOrder(orderID, requesterId);
  if (ownedErr) {
    return res.status(ownedErr.status).json({
      success: false,
      message: ownedErr.message,
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

  const { error: ownedErr, order } = await findOwnedOrder(orderID, requesterId);
  if (ownedErr) {
    return res.status(ownedErr.status).json({
      success: false,
      message: ownedErr.message,
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
    const order = await orderReadService.getOrderByIdWithRelations(orderID);

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
    return sendOrderReadError(res, error, "Error retrieving order");
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

  const { error: ownedErr, order } = await findOwnedOrder(orderID, requesterId);
  if (ownedErr) {
    return res.status(ownedErr.status).json({ success: false, message: ownedErr.message });
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
        return res.redirect(orderPaymentService.getSessionNotFoundRedirectUrl("order"));
      }

      if (session.status === "success" && session.redirectTo) {
        return res.redirect(session.redirectTo);
      }

      if (responseCode !== "00") {
        const redirectTo = await orderPaymentService.failPaymentSessionAndBuildRedirect({
          session,
          kind: "order",
          reason: "payment_declined",
        });
        return res.redirect(redirectTo);
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

        const redirectTo = await orderPaymentService.succeedPaymentSessionAndBuildRedirect({
          session,
          kind: "order",
          idKey: "orderId",
          idValue: message._id,
        });
        return res.redirect(redirectTo);
      }

      return res.redirect(
        orderPaymentService.buildCheckoutResultUrl({
          kind: "order",
          status: "failed",
          reason: "create_order_failed",
        }),
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
    const stats = await orderStatsService.calculateTotalPriceAllOrders();
    if (!stats.found) {
      return res.status(404).json({
        success: false,
        message: "No orders found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Total price for all orders calculated successfully",
      totalPrice: stats.totalPrice,
    });
  } catch (error) {
    return sendStatsError(res, error, "Error calculating total price for all orders");
  }
});
const mostPurchasedProduct = asyncHandler(async (req, res) => {
  try {
    const topProducts = await orderStatsService.getMostPurchasedProducts(7);
    if (topProducts.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No products found in orders within the last 7 days.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Top purchased products in the last 7 days fetched successfully",
      products: topProducts,
    });
  } catch (error) {
    return sendStatsError(res, error, "Error fetching top purchased products");
  }
});

const totalSalesByMonth = asyncHandler(async (req, res) => {
  try {
    const { year } = req.params;
    const formattedData = await orderStatsService.getTotalSalesByMonth(year);

    res.status(200).json({
      success: true,
      message: "Total sales by month fetched successfully",
      data: formattedData,
    });
  } catch (error) {
    return sendStatsError(res, error, "Error fetching total sales by month");
  }
});

const topUsersByOrders = asyncHandler(async (req, res) => {
  try {
    const topUsers = await orderStatsService.getTopUsersByOrders(5);

    res.status(200).json({
      success: true,
      message: "Top 5 users by order count fetched successfully",
      data: topUsers,
    });
  } catch (error) {
    return sendStatsError(res, error, "Error fetching top users");
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
