const Order = require("../collection/Order/model");
const Product = require("../collection/Product/model");
const Pet = require("../collection/Pets/model");
const User = require("../collection/Users/model");
const Voucher = require("../collection/Voucher/model");

const createOrderService = async ({
  products,
  paymentMethod,
  coupon,
  address,
  note,
  orderBy,
}) => {
  try {
    if (!products || !address || !orderBy) {
      throw new Error("Missing required fields");
    }

    let totalPrice = 0;

    for (let item of products) {
      let product = await Product.findById(item.id);
      if (product) {
        if (
          !product.quantity ||
          product.quantity <= 0 ||
          product.sold === true
        ) {
          throw new Error(`Product ${product.nameProduct} is out of stock`);
        }
        if (item.count > product.quantity) {
          throw new Error(
            `Product ${product.nameProduct} has only ${product.quantity} items in stock`
          );
        }

        totalPrice += product.price * item.count;
      } else {
        let pet = await Pet.findById(item.id);
        if (pet) {
          if (!pet.quantity || pet.quantity <= 0 || pet.sold === true) {
            throw new Error(`Pet ${pet.namePet} is out of stock`);
          }
          if (item.count > pet.quantity) {
            throw new Error(
              `Pet ${pet.namePet} has only ${pet.quantity} items in stock`
            );
          }

          totalPrice += pet.price * item.count;
        } else {
          throw new Error(
            `Item with ID ${item.id} not found in products or pets`
          );
        }
      }
    }

    if (coupon) {
      const user = await User.findById(req.user._id).populate(
        "Voucher.voucherID"
      );
      const userVouchers = user.Voucher.map((v) => v.voucherID.toString());

      if (userVouchers.includes(coupon)) {
        const voucher = await Voucher.findById(coupon);
        if (voucher) {
          totalPrice -= (totalPrice * voucher.discount) / 100;
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
      throw new Error("Failed to create order");
    }

    return newOrder;
  } catch (error) {
    throw new Error(error.message);
  }
};

const returnTotalPrice = async ({ products }) => {
  let totalPrice = 0;

  for (let item of products) {
    let product = await Product.findById(item.id);
    if (product) {
      if (!product.quantity || product.quantity <= 0 || product.sold === true) {
        throw new Error(`Product ${product.nameProduct} is out of stock`);
      }
      if (item.count > product.quantity) {
        throw new Error(
          `Product ${product.nameProduct} has only ${product.quantity} items in stock`
        );
      }

      totalPrice += product.price * item.count;
    } else {
      let pet = await Pet.findById(item.id);
      if (pet) {
        if (!pet.quantity || pet.quantity <= 0 || pet.sold === true) {
          throw new Error(`Pet ${pet.namePet} is out of stock`);
        }
        if (item.count > pet.quantity) {
          throw new Error(
            `Pet ${pet.namePet} has only ${pet.quantity} items in stock`
          );
        }

        totalPrice += pet.price * item.count;
      } else {
        throw new Error(
          `Item with ID ${item.id} not found in products or pets`
        );
      }
    }
  }
  return totalPrice;
};

module.exports = {
  createOrderService,
  returnTotalPrice,
};
