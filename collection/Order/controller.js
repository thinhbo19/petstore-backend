const Order = require("./model");
const Product = require("../Product/model");
const Pet = require("../Pets/model");
const User = require("../Users/model");
const Voucher = require("../Voucher/model");
const PaymentSession = require("../PaymentSession/model");
const orderService = require("../../service/orderService");
const asyncHandler = require("express-async-handler");
const moment = require("moment");
const querystring = require("qs");
const crypto = require("crypto");
const { generateOrderConfirmationEmail } = require("../../service/emailOrder");
const sendMailOrder = require("../../utils/sendMailOrderjs");
const { enrichOrderDoc } = require("../../utils/enrichOrderProducts");
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

const buildTxnRef = () =>
  `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

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

    for (let item of lineItems) {
      let product = await Product.findById(item.id);
      if (product) {
        const stockProd = Number(product.quantity);
        if (
          !Number.isFinite(stockProd) ||
          stockProd < 1 ||
          product.sold === true
        ) {
          return res.status(400).json({
            success: false,
            message: `Product ${product.nameProduct} is out of stock`,
          });
        }
        if (item.count > stockProd) {
          return res.status(400).json({
            success: false,
            message: `Product ${product.nameProduct} has only ${stockProd} items in stock`,
          });
        }

        const unitPrice = Number(product.price);
        totalPrice +=
          (Number.isFinite(unitPrice) ? unitPrice : 0) * item.count;
      } else {
        let pet = await Pet.findById(item.id);
        if (pet) {
          const stockPet = Number(pet.quantity);
          if (
            !Number.isFinite(stockPet) ||
            stockPet < 1 ||
            pet.sold === true
          ) {
            return res.status(400).json({
              success: false,
              message: `Pet ${pet.namePet} is out of stock`,
            });
          }
          if (item.count > stockPet) {
            return res.status(400).json({
              success: false,
              message: `Pet ${pet.namePet} has only ${stockPet} items in stock`,
            });
          }

          const petPrice = Number(pet.price);
          totalPrice +=
            (Number.isFinite(petPrice) ? petPrice : 0) * item.count;
        } else {
          return res.status(404).json({
            success: false,
            message: `Item with ID ${item.id} not found in products or pets`,
          });
        }
      }
    }

    if (coupon) {
      const userForCoupon = await User.findById(orderBy).populate(
        "Voucher.voucherID",
      );
      const userVouchers = userForCoupon.Voucher.map((v) => v.voucherID);
      const matchedUserVoucher = userVouchers.find((v) =>
        v._id.equals(coupon),
      );

      if (matchedUserVoucher) {
        const voucherDoc = await Voucher.findById(coupon);
        if (voucherDoc) {
          const discountAmount = (totalPrice * voucherDoc.discount) / 100;
          totalPrice = Math.max(0, totalPrice - discountAmount);
        } else {
          return res.status(404).json({
            success: false,
            message: "Coupon not found",
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          message: "Coupon not valid for this user",
        });
      }
    }

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
      for (let item of lineItems) {
        let product = await Product.findById(item.id);
        let pet = await Pet.findById(item.id);
        if (product) {
          const stockProd = Number(product.quantity);
          if (!Number.isFinite(stockProd)) {
            throw new Error(
              `Invalid quantity in DB for product ${product.nameProduct}`,
            );
          }
          const newQuantityProd = stockProd - item.count;
          await Product.findByIdAndUpdate(item.id, {
            quantity: newQuantityProd,
            sold: newQuantityProd === 0,
          });
        } else if (pet) {
          const stockPet = Number(pet.quantity);
          if (!Number.isFinite(stockPet)) {
            throw new Error(`Invalid quantity in DB for pet ${pet.namePet}`);
          }
          const newQuantityPet = stockPet - item.count;
          await Pet.findByIdAndUpdate(item.id, {
            quantity: newQuantityPet,
            sold: newQuantityPet === 0,
          });
        }
      }

      const user = await User.findById(orderBy);
      if (user?.cart?.length) {
        for (const item of lineItems) {
          const idx = user.cart.findIndex((c) => c.id.equals(item.id));
          if (idx >= 0) {
            const cartQty = Number(user.cart[idx].quantity);
            const safeCartQty = Number.isFinite(cartQty) ? cartQty : 0;
            const remaining = safeCartQty - item.count;
            if (!Number.isFinite(remaining) || remaining <= 0) {
              user.cart.splice(idx, 1);
            } else {
              user.cart[idx].quantity = remaining;
            }
          }
        }
        await user.save();
      }
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

    // Email không được làm fail API: đơn đã tạo + kho đã trừ; SMTP hoặc template lỗi chỉ ghi log.
    if (user?.email) {
      try {
        const html = generateOrderConfirmationEmail(
          user.username || "Khách hàng",
          newOrder._id,
          newOrder.products,
          newOrder.totalPrice
        );
        await sendMailOrder({
          email: user.email,
          subject: "You have just placed an order successfully",
          html,
        });
      } catch (mailErr) {
        console.error("Order confirmation email failed:", mailErr?.message || mailErr);
      }
    }

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
    const orders = await Order.findById(orderID)
      .populate("OrderBy", "username email mobile")
      .populate({
        path: "coupon",
        model: "Voucher",
        select: "nameVoucher",
      })
      .exec();

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

    const orders = await Order.find({ OrderBy: userID })
      .populate("OrderBy", "username email mobile")
      .populate({
        path: "coupon",
        model: "Voucher",
        select: "nameVoucher",
      })
      .exec();

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

  const products = order.products || [];
  for (const item of products) {
    if (!item?.id || !item?.count) continue;
    const pid = item.id;
    const product = await Product.findById(pid);
    if (product) {
      const newQty = (product.quantity ?? 0) + item.count;
      await Product.findByIdAndUpdate(pid, {
        quantity: newQty,
        sold: newQty === 0,
      });
    } else {
      const pet = await Pet.findById(pid);
      if (pet) {
        const newQty = (pet.quantity ?? 0) + item.count;
        await Pet.findByIdAndUpdate(pid, {
          quantity: newQty,
          sold: newQty === 0,
        });
      }
    }
  }

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
    const order = await Order.findById(orderID)
      .populate("OrderBy", "username email mobile")
      .populate({
        path: "coupon",
        model: "Voucher",
        select: "nameVoucher",
      })
      .exec();

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

    var ipAddr =
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      req.connection.socket.remoteAddress;

    var tmnCode = process.env.VNP_TMNCODE;
    var secretKey = process.env.VNP_HASHSECRET;
    var vnpUrl = process.env.VNP_URL;
    var returnUrl = process.env.VNP_RETURNURL;

    var date = new Date();

    var createDate = moment(date).format("YYYYMMDDHHmmss");
    const amount = priceTotal;
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
        const user = await User.findById(userId);
        const userCart = user?.cart || [];
        const updatedCartProducts = userCart.filter((cartItem) => {
          return !message.products.some((orderItem) => {
            return (
              cartItem.id.equals(orderItem.id) &&
              cartItem.quantity === orderItem.count
            );
          });
        });
        if (user) {
          user.cart = updatedCartProducts;
          await user.save();
        }

        if (user?.email) {
          const html = generateOrderConfirmationEmail(
            user.username,
            message._id,
            message.products,
            message.totalPrice,
          );
          await sendMailOrder({
            email: user.email,
            subject: "You have just placed an order successfully",
            html,
          });
        }

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
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});
const hanldMoMoPay = asyncHandler(async (req, res) => {
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
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
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
  hanldMoMoPay,
  totalPriceOrder,
  mostPurchasedProduct,
  topUsersByOrders,
  totalSalesByMonth,
};
