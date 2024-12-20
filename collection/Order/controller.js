const Order = require("./model");
const Product = require("../Product/model");
const Pet = require("../Pets/model");
const User = require("../Users/model");
const Voucher = require("../Voucher/model");
const orderService = require("../../service/orderService");
const asyncHandler = require("express-async-handler");
const moment = require("moment");
const querystring = require("qs");
const crypto = require("crypto");
const { generateOrderConfirmationEmail } = require("../../service/emailOrder");
const sendMailOrder = require("../../utils/sendMailOrderjs");
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

const createOrder = asyncHandler(async (req, res) => {
  try {
    const { products, paymentMethod, coupon, address, note, orderBy } =
      req.body;

    if (!products || !address || !orderBy) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    let totalPrice = 0;

    for (let item of products) {
      let product = await Product.findById(item.id);
      if (product) {
        if (
          product.quantity === null ||
          product.quantity <= 0 ||
          product.sold === true
        ) {
          return res.status(400).json({
            success: false,
            message: `Product ${product.nameProduct} is out of stock`,
          });
        }
        if (item.count > product.quantity) {
          return res.status(400).json({
            success: false,
            message: `Product ${product.nameProduct} has only ${product.quantity} items in stock`,
          });
        }

        totalPrice += product.price * item.count;
      } else {
        let pet = await Pet.findById(item.id);
        if (pet) {
          if (pet.quantity === null || pet.quantity <= 0 || pet.sold === true) {
            return res.status(400).json({
              success: false,
              message: `Pet ${pet.namePet} is out of stock`,
            });
          }
          if (item.count > pet.quantity) {
            return res.status(400).json({
              success: false,
              message: `Product ${pet.namePet} has only ${product.quantity} items in stock`,
            });
          }

          totalPrice += pet.price * item.count;
        } else {
          return res.status(404).json({
            success: false,
            message: `Item with ID ${item.id} not found in products or pets`,
          });
        }
      }
    }

    if (coupon) {
      const user = await User.findById(orderBy).populate("Voucher.voucherID");
      const userVouchers = user.Voucher.map((v) => v.voucherID);
      const res = userVouchers.find((v) => v._id.equals(coupon));

      if (res) {
        const voucher = await Voucher.findById(coupon);
        if (voucher) {
          const discountAmount = (totalPrice * voucher.discount) / 100;
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
      products,
      totalPrice,
      paymentMethod,
      coupon: coupon || null,
      address,
      Note: note || "",
      OrderBy: orderBy,
      status: "Processing",
    });

    for (let item of products) {
      let product = await Product.findById(item.id);
      let pet = await Pet.findById(item.id);
      if (product) {
        let newQuantityProd = product.quantity - item.count;
        await Product.findByIdAndUpdate(item.id, {
          quantity: newQuantityProd,
          sold: newQuantityProd === 0,
        });
      } else {
        let newQuantityPet = pet.quantity - item.count;
        await Pet.findByIdAndUpdate(item.id, {
          quantity: newQuantityPet,
          sold: newQuantityPet === 0,
        });
      }
    }

    if (!newOrder) {
      return res.status(500).json({
        success: false,
        message: "Failed to create order",
      });
    }
    const user = await User.findById(orderBy);
    const html = generateOrderConfirmationEmail(
      user.username,
      newOrder._id,
      newOrder.products,
      newOrder.totalPrice
    );

    const data = {
      email: user.email,
      subject: "You have just placed an order successfully",
      html,
    };
    await sendMailOrder(data);
    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: newOrder,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
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
const getUserOrder = asyncHandler(async (req, res) => {
  const { userID } = req.params;

  try {
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
const handlePaymentUrl = asyncHandler(async (req, res) => {
  try {
    const { orderBy, products, coupon, note, address, paymentMethod } =
      req.body;

    const priceTotal = await orderService.returnTotalPrice({ products });

    inforOrder.orderBy = orderBy;
    inforOrder.coupon = coupon || null;
    inforOrder.note = note;
    inforOrder.address = address;
    inforOrder.status = "Processing";
    inforOrder.paymentMethod = paymentMethod;
    inforOrder.totalPrice = priceTotal;
    inforOrder.products = products;

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
      const message = await orderService.createOrderService({
        ...inforOrder,
      });

      if (message) {
        const userId = message.OrderBy;
        const user = await User.findById(userId);
        const userCart = user.cart;
        const updatedCartProducts = userCart.filter((cartItem) => {
          return !message.products.some((orderItem) => {
            return (
              cartItem.id.equals(orderItem.id) &&
              cartItem.quantity === orderItem.count
            );
          });
        });
        user.cart = updatedCartProducts;
        await user.save();

        const html = generateOrderConfirmationEmail(
          user.username,
          message._id,
          message.products,
          message.totalPrice
        );

        const data = {
          email: user.email,
          subject: "You have just placed an order successfully",
          html,
        };

        await sendMailOrder(data);
        return res.redirect(
          `${process.env.URL_CLIENT}/order-detail/${message._id}`
        );
      } else {
        return res
          .status(400)
          .json({ success: false, message: "Order creation failed" });
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
  deleteOrder,
  updateStatusOrder,
  handlePaymentUrl,
  handleVnPayReturn,
  hanldMoMoPay,
  totalPriceOrder,
  mostPurchasedProduct,
  topUsersByOrders,
  totalSalesByMonth,
};
