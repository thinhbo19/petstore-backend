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
const { normalizeId } = require("../../utils/idUtils");
const { ERROR_CODES } = require("../../utils/apiResponse");
const { HttpError } = require("../../utils/httpError");
require("dotenv").config();

function mapOrderItemErrorToHttp(calcErr) {
  const message = calcErr?.message || "Invalid order items";
  const status = message.includes("not found") ? 404 : 400;
  return { status, message };
}

function throwHttp(status, message, code) {
  throw new HttpError(status, message, code);
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
      throwHttp(400, "Missing required fields", ERROR_CODES.VALIDATION);
    }

    if (requesterRole !== "Admin" && requesterId !== String(orderBy)) {
      throwHttp(
        403,
        "You are not allowed to create order for another user",
        ERROR_CODES.FORBIDDEN
      );
    }

    const { error: lineErr, normalized: lineItems } =
      orderService.normalizeOrderLineItems(products);
    if (lineErr) {
      throwHttp(400, lineErr, ERROR_CODES.VALIDATION);
    }

    let totalPrice = 0;
    try {
      totalPrice = await orderService.returnTotalPrice({ products: lineItems });
    } catch (calcErr) {
      const { status, message } = mapOrderItemErrorToHttp(calcErr);
      throwHttp(
        status,
        message,
        status === 404 ? ERROR_CODES.NOT_FOUND : ERROR_CODES.VALIDATION
      );
    }

    const couponResult = await orderService.applyCouponForUser({
      orderBy,
      coupon,
      totalPrice,
    });
    if (couponResult.error) {
      throwHttp(
        couponResult.status,
        couponResult.error,
        couponResult.status === 404 ? ERROR_CODES.NOT_FOUND : ERROR_CODES.VALIDATION
      );
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
      throwHttp(500, "Failed to create order", ERROR_CODES.INTERNAL);
    }

    try {
      await orderFinalizeService.decreaseInventoryByLineItems(lineItems);
      await orderFinalizeService.decreaseUserCartQuantities({ userId: orderBy, lineItems });
    } catch (invErr) {
      await Order.findByIdAndDelete(newOrder._id);
      console.error("createOrder finalize error:", invErr?.message || invErr);
      throwHttp(
        500,
        "Không thể hoàn tất đơn hàng (cập nhật kho hoặc giỏ). Đơn tạm đã được hủy.",
        ERROR_CODES.INTERNAL
      );
    }

    const user = await User.findById(orderBy);
    await orderFinalizeService.sendOrderConfirmationEmailSafe({ user, order: newOrder });

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: newOrder,
    });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error("createOrder error:", error?.message || error);
    throwHttp(500, "Internal server error", ERROR_CODES.INTERNAL);
  }
});
const getAllOrders = asyncHandler(async (req, res) => {
  try {
    const orders = await orderReadService.getAllOrdersWithUser();

    if (!orders) {
      throwHttp(404, "No orders found", ERROR_CODES.NOT_FOUND);
    }

    return res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    throwHttp(500, "Error retrieving orders", ERROR_CODES.INTERNAL);
  }
});
const deleteOrder = asyncHandler(async (req, res) => {
  const { orderID } = req.params;

  try {
    const order = await Order.findByIdAndDelete(orderID);

    if (!order) {
      throwHttp(404, "Order not found", ERROR_CODES.NOT_FOUND);
    }

    return res.status(200).json({
      success: true,
      message: "Order deleted successfully",
    });
  } catch (error) {
    throwHttp(500, "Error deleting order", ERROR_CODES.INTERNAL);
  }
});
const getOneOrder = asyncHandler(async (req, res) => {
  const { orderID } = req.params;

  try {
    const orders = await orderReadService.getOrderByIdWithRelations(orderID);

    if (!orders) {
      throwHttp(404, "No order found", ERROR_CODES.NOT_FOUND);
    }

    const data = await enrichOrderDoc(orders);
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    throwHttp(500, "Error retrieving orders", ERROR_CODES.INTERNAL);
  }
});
const getUserOrder = asyncHandler(async (req, res) => {
  const { userID } = req.params;
  const requesterId = String(req.user?._id || "");
  const requesterRole = req.user?.role;

  try {
    if (requesterRole !== "Admin" && requesterId !== String(userID)) {
      throwHttp(403, "Forbidden", ERROR_CODES.FORBIDDEN);
    }

    const orders = await orderReadService.getOrdersByUserWithRelations(userID);

    if (!orders) {
      throwHttp(404, "No order found", ERROR_CODES.NOT_FOUND);
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
    throwHttp(500, "Error retrieving orders", ERROR_CODES.INTERNAL);
  }
});
const updateStatusOrder = asyncHandler(async (req, res) => {
  const { orderID } = req.params;
  const { status } = req.body;
  const validStatuses = ["Processing", "Shipping", "Success", "Cancelled"];
  if (!validStatuses.includes(String(status))) {
    throwHttp(400, "Invalid status", ERROR_CODES.VALIDATION);
  }

  const response = await Order.findByIdAndUpdate(
    orderID,
    { status },
    { new: true }
  );

  if (response) {
    const io = req.app.get("io");
    const getOnlineUsers = req.app.get("getOnlineUsers");
    if (io && typeof getOnlineUsers === "function") {
      const targetUserId = normalizeId(response.OrderBy?._id || response.OrderBy || "");
      const onlineUsers = getOnlineUsers();
      const receivers = onlineUsers.filter(
        (user) => normalizeId(user.userId) === targetUserId,
      );
      console.info(
        `[order-status-notify] order=${response._id} target=${targetUserId} receivers=${receivers.length}`,
      );
      for (const receiver of receivers) {
        io.to(receiver.socketId).emit("getNotification", {
          type: "ORDER_STATUS_UPDATED",
          level: "high",
          title: "Đơn hàng cập nhật trạng thái",
          body: `Đơn #${String(response._id).slice(-8).toUpperCase()} đã chuyển sang trạng thái ${status}.`,
          href: `/order-detail/${response._id}`,
          orderId: String(response._id),
          status,
          date: new Date(),
        });
      }
    }
  }

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
    throwHttp(
      ownedErr.status,
      ownedErr.message,
      ownedErr.status === 403 ? ERROR_CODES.FORBIDDEN : ERROR_CODES.NOT_FOUND
    );
  }

  if (order.status !== "Shipping") {
    throwHttp(
      400,
      "Chỉ đơn đang giao mới xác nhận nhận hàng được",
      ERROR_CODES.VALIDATION
    );
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
    throwHttp(
      ownedErr.status,
      ownedErr.message,
      ownedErr.status === 403 ? ERROR_CODES.FORBIDDEN : ERROR_CODES.NOT_FOUND
    );
  }

  if (order.status !== "Processing") {
    throwHttp(400, "Chỉ đơn đang xử lý mới được hủy", ERROR_CODES.VALIDATION);
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
      throwHttp(404, "No order found", ERROR_CODES.NOT_FOUND);
    }

    if (
      requesterRole !== "Admin" &&
      String(order.OrderBy?._id || order.OrderBy) !== requesterId
    ) {
      throwHttp(403, "Forbidden", ERROR_CODES.FORBIDDEN);
    }

    const viewerForRating =
      requesterRole === "Admin" ? undefined : requesterId;
    const data = await enrichOrderDoc(order, { viewerId: viewerForRating });
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    throwHttp(500, "Error retrieving order", ERROR_CODES.INTERNAL);
  }
});

const requestAfterSalesByUser = asyncHandler(async (req, res) => {
  const { orderID } = req.params;
  const requesterId = String(req.user?._id || "");
  const { type, reason } = req.body || {};

  if (!["Return", "Refund", "Complaint"].includes(type)) {
    throwHttp(400, "Invalid after-sales type", ERROR_CODES.VALIDATION);
  }
  if (!reason || String(reason).trim().length < 5) {
    throwHttp(400, "Reason is required", ERROR_CODES.VALIDATION);
  }

  const { error: ownedErr, order } = await findOwnedOrder(orderID, requesterId);
  if (ownedErr) {
    throwHttp(
      ownedErr.status,
      ownedErr.message,
      ownedErr.status === 403 ? ERROR_CODES.FORBIDDEN : ERROR_CODES.NOT_FOUND
    );
  }
  if (order.status !== "Success") {
    throwHttp(
      400,
      "Only completed orders can request after-sales",
      ERROR_CODES.VALIDATION
    );
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
    throwHttp(400, "Invalid after-sales status", ERROR_CODES.VALIDATION);
  }
  const order = await Order.findById(orderID);
  if (!order || !order.afterSales?.requested) {
    throwHttp(404, "After-sales request not found", ERROR_CODES.NOT_FOUND);
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
      throwHttp(
        403,
        "You are not allowed to create payment URL for another user",
        ERROR_CODES.FORBIDDEN
      );
    }

    const { error: payLineErr, normalized: payLineItems } =
      orderService.normalizeOrderLineItems(products);
    if (payLineErr) {
      throwHttp(400, payLineErr, ERROR_CODES.VALIDATION);
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
    throwHttp(500, "Error", ERROR_CODES.INTERNAL);
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
      throwHttp(400, "Invalid signature", ERROR_CODES.VALIDATION);
    }
  } catch (error) {
    throwHttp(500, "Server error", ERROR_CODES.INTERNAL);
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
      throwHttp(500, "Failed to create MoMo payment URL", ERROR_CODES.INTERNAL);
    }
  } catch (error) {
    throwHttp(500, "Server error", ERROR_CODES.INTERNAL);
  }
});
const totalPriceOrder = asyncHandler(async (req, res) => {
  try {
    const stats = await orderStatsService.calculateTotalPriceAllOrders();
    if (!stats.found) {
      throwHttp(404, "No orders found", ERROR_CODES.NOT_FOUND);
    }

    res.status(200).json({
      success: true,
      message: "Total price for all orders calculated successfully",
      data: { totalPrice: stats.totalPrice },
      totalPrice: stats.totalPrice,
    });
  } catch (error) {
    throwHttp(
      500,
      "Error calculating total price for all orders",
      ERROR_CODES.INTERNAL
    );
  }
});
const mostPurchasedProduct = asyncHandler(async (req, res) => {
  try {
    const topProducts = await orderStatsService.getMostPurchasedProducts(7);
    if (topProducts.length === 0) {
      throwHttp(
        404,
        "No products found in orders within the last 7 days.",
        ERROR_CODES.NOT_FOUND
      );
    }

    res.status(200).json({
      success: true,
      message: "Top purchased products in the last 7 days fetched successfully",
      data: topProducts,
      products: topProducts,
    });
  } catch (error) {
    throwHttp(500, "Error fetching top purchased products", ERROR_CODES.INTERNAL);
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
    throwHttp(500, "Error fetching total sales by month", ERROR_CODES.INTERNAL);
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
    throwHttp(500, "Error fetching top users", ERROR_CODES.INTERNAL);
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
