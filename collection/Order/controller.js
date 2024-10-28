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

module.exports = {
  createOrder,
  getAllOrders,
  getOneOrder,
  getUserOrder,
  deleteOrder,
  updateStatusOrder,
  handlePaymentUrl,
  handleVnPayReturn,
};
