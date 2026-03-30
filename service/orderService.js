const Order = require("../collection/Order/model");
const Product = require("../collection/Product/model");
const Pet = require("../collection/Pets/model");
const User = require("../collection/Users/model");
const Voucher = require("../collection/Voucher/model");

/**
 * Ensures each line has a positive integer count (accepts `count` or `quantity` from client).
 * Prevents NaN reaching Mongoose updates on Product/Pet/User.cart.quantity.
 */
function normalizeOrderLineItems(products) {
  if (!Array.isArray(products) || products.length === 0) {
    return { error: "products must be a non-empty array", normalized: null };
  }
  const normalized = [];
  for (const item of products) {
    if (item == null || item.id == null || item.id === "") {
      return { error: "Each line item must have a valid id", normalized: null };
    }
    const rawQty = item.count != null ? item.count : item.quantity;
    const count = Number(rawQty);
    if (
      !Number.isFinite(count) ||
      count < 1 ||
      count > 1_000_000 ||
      Math.floor(count) !== count
    ) {
      return {
        error:
          "Each line item must have a valid positive integer count (or quantity)",
        normalized: null,
      };
    }
    const line = { id: item.id, count };
    if (item.price != null) {
      const p = Number(item.price);
      if (Number.isFinite(p)) line.price = p;
    }
    if (typeof item.img === "string") line.img = item.img;
    if (typeof item.name === "string") line.name = item.name;
    normalized.push(line);
  }
  return { error: null, normalized };
}

const createOrderService = async ({
  products,
  paymentMethod,
  coupon,
  address,
  receiverName,
  receiverPhone,
  note,
  orderBy,
}) => {
  try {
    if (!products || !address || !orderBy) {
      throw new Error("Missing required fields");
    }

    const { error: normErr, normalized } = normalizeOrderLineItems(products);
    if (normErr) {
      throw new Error(normErr);
    }
    const lineItems = normalized;

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
          throw new Error(`Product ${product.nameProduct} is out of stock`);
        }
        if (item.count > stockProd) {
          throw new Error(
            `Product ${product.nameProduct} has only ${stockProd} items in stock`
          );
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
            throw new Error(`Pet ${pet.namePet} is out of stock`);
          }
          if (item.count > stockPet) {
            throw new Error(
              `Pet ${pet.namePet} has only ${stockPet} items in stock`
            );
          }

          const petPrice = Number(pet.price);
          totalPrice += (Number.isFinite(petPrice) ? petPrice : 0) * item.count;
        } else {
          throw new Error(
            `Item with ID ${item.id} not found in products or pets`
          );
        }
      }
    }

    if (coupon) {
      const user = await User.findById(orderBy).populate("Voucher.voucherID");
      if (!user) {
        throw new Error("User not found");
      }
      const userVouchers = (user.Voucher || []).map((v) =>
        String(v.voucherID?._id || v.voucherID),
      );
      if (!userVouchers.includes(String(coupon))) {
        throw new Error("Coupon not valid for this user");
      }
      const voucher = await Voucher.findById(coupon);
      if (!voucher) {
        throw new Error("Coupon not found");
      }
      totalPrice = Math.max(0, totalPrice - (totalPrice * voucher.discount) / 100);
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

    for (let item of lineItems) {
      let product = await Product.findById(item.id);
      let pet = await Pet.findById(item.id);

      if (product) {
        const stockProd = Number(product.quantity);
        if (!Number.isFinite(stockProd)) {
          throw new Error(
            `Invalid quantity in DB for product ${product.nameProduct}`
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

    if (!newOrder) {
      throw new Error("Failed to create order");
    }

    return newOrder;
  } catch (error) {
    throw new Error(error.message);
  }
};

const returnTotalPrice = async ({ products }) => {
  const { error: normErr, normalized } = normalizeOrderLineItems(products);
  if (normErr) {
    throw new Error(normErr);
  }
  const lineItems = normalized;

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
        throw new Error(`Product ${product.nameProduct} is out of stock`);
      }
      if (item.count > stockProd) {
        throw new Error(
          `Product ${product.nameProduct} has only ${stockProd} items in stock`
        );
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
          throw new Error(`Pet ${pet.namePet} is out of stock`);
        }
        if (item.count > stockPet) {
          throw new Error(
            `Pet ${pet.namePet} has only ${stockPet} items in stock`
          );
        }

        const petPrice = Number(pet.price);
        totalPrice += (Number.isFinite(petPrice) ? petPrice : 0) * item.count;
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
  normalizeOrderLineItems,
};
