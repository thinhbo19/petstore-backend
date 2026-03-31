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

async function getSellableItemById(itemId) {
  const product = await Product.findById(itemId);
  if (product) {
    return {
      model: "product",
      doc: product,
      name: product.nameProduct,
      price: Number(product.price),
      stock: Number(product.quantity),
    };
  }

  const pet = await Pet.findById(itemId);
  if (pet) {
    return {
      model: "pet",
      doc: pet,
      name: pet.namePet,
      price: Number(pet.price),
      stock: Number(pet.quantity),
    };
  }

  return null;
}

function validateStock(item, sellable) {
  if (!sellable) {
    throw new Error(`Item with ID ${item.id} not found in products or pets`);
  }

  if (
    !Number.isFinite(sellable.stock) ||
    sellable.stock < 1 ||
    sellable.doc.sold === true
  ) {
    throw new Error(
      `${sellable.model === "product" ? "Product" : "Pet"} ${sellable.name} is out of stock`
    );
  }

  if (item.count > sellable.stock) {
    throw new Error(
      `${sellable.model === "product" ? "Product" : "Pet"} ${sellable.name} has only ${sellable.stock} items in stock`
    );
  }
}

async function computeTotalFromLineItems(lineItems) {
  let totalPrice = 0;

  for (const item of lineItems) {
    const sellable = await getSellableItemById(item.id);
    validateStock(item, sellable);
    totalPrice += (Number.isFinite(sellable.price) ? sellable.price : 0) * item.count;
  }

  return totalPrice;
}

async function decrementInventoryFromLineItems(lineItems) {
  for (const item of lineItems) {
    const sellable = await getSellableItemById(item.id);
    if (!sellable) continue;

    if (!Number.isFinite(sellable.stock)) {
      throw new Error(
        `Invalid quantity in DB for ${sellable.model} ${sellable.name}`
      );
    }

    const newQuantity = sellable.stock - item.count;
    const Model = sellable.model === "product" ? Product : Pet;
    await Model.findByIdAndUpdate(item.id, {
      quantity: newQuantity,
      sold: newQuantity === 0,
    });
  }
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
  if (!products || !address || !orderBy) {
    throw new Error("Missing required fields");
  }

  const { error: normErr, normalized } = normalizeOrderLineItems(products);
  if (normErr) {
    throw new Error(normErr);
  }
  const lineItems = normalized;

  let totalPrice = await computeTotalFromLineItems(lineItems);

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

  await decrementInventoryFromLineItems(lineItems);

  if (!newOrder) {
    throw new Error("Failed to create order");
  }

  return newOrder;
};

const returnTotalPrice = async ({ products }) => {
  const { error: normErr, normalized } = normalizeOrderLineItems(products);
  if (normErr) {
    throw new Error(normErr);
  }
  const lineItems = normalized;

  return computeTotalFromLineItems(lineItems);
};

module.exports = {
  createOrderService,
  returnTotalPrice,
  normalizeOrderLineItems,
};
