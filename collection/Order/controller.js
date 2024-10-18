const Order = require("./model");
const Product = require("../Product/model");
const Pet = require("../Pets/model");
const asyncHandler = require("express-async-handler");

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
    const orders = await Order.find({ OrderBy: userID }).populate(
      "OrderBy",
      "username email mobile"
    );

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

module.exports = {
  createOrder,
  getAllOrders,
  getOneOrder,
  getUserOrder,
  deleteOrder,
  updateStatusOrder,
};
