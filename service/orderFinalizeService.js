const Product = require("../collection/Product/model");
const Pet = require("../collection/Pets/model");
const User = require("../collection/Users/model");
const { generateOrderConfirmationEmail } = require("./emailOrder");
const sendMailOrder = require("../utils/sendMailOrderjs");

async function adjustInventoryByLineItems(lineItems, direction) {
  const delta = direction === "increase" ? 1 : -1;
  const countById = new Map();
  for (const item of lineItems || []) {
    const id = String(item?.id || "");
    if (!id) continue;
    const count = Number(item?.count) || 0;
    countById.set(id, (countById.get(id) || 0) + count);
  }
  if (!countById.size) return;

  const ids = Array.from(countById.keys());
  const products = await Product.find({ _id: { $in: ids } });
  const productById = new Map(products.map((doc) => [String(doc._id), doc]));
  const petIds = ids.filter((id) => !productById.has(id));
  const pets = petIds.length ? await Pet.find({ _id: { $in: petIds } }) : [];
  const petById = new Map(pets.map((doc) => [String(doc._id), doc]));

  const productOps = [];
  const petOps = [];

  for (const [id, count] of countById.entries()) {
    const product = productById.get(id);
    const pet = product ? null : petById.get(id);
    if (product) {
      const stockProd = Number(product.quantity);
      if (!Number.isFinite(stockProd)) {
        throw new Error(`Invalid quantity in DB for product ${product.nameProduct}`);
      }
      const newQuantityProd = stockProd + delta * count;
      productOps.push({
        updateOne: {
          filter: { _id: id },
          update: {
            $set: {
              quantity: newQuantityProd,
              sold: newQuantityProd === 0,
            },
          },
        },
      });
    } else if (pet) {
      const stockPet = Number(pet.quantity);
      if (!Number.isFinite(stockPet)) {
        throw new Error(`Invalid quantity in DB for pet ${pet.namePet}`);
      }
      const newQuantityPet = stockPet + delta * count;
      petOps.push({
        updateOne: {
          filter: { _id: id },
          update: {
            $set: {
              quantity: newQuantityPet,
              sold: newQuantityPet === 0,
            },
          },
        },
      });
    }
  }

  if (productOps.length) {
    await Product.bulkWrite(productOps);
  }
  if (petOps.length) {
    await Pet.bulkWrite(petOps);
  }
}

async function decreaseInventoryByLineItems(lineItems) {
  return adjustInventoryByLineItems(lineItems, "decrease");
}

async function increaseInventoryByLineItems(lineItems) {
  return adjustInventoryByLineItems(lineItems, "increase");
}

async function decreaseUserCartQuantities({ userId, lineItems }) {
  const user = await User.findById(userId);
  if (!user?.cart?.length) return;

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

async function removeExactPurchasedItemsFromCart({ userId, purchasedProducts }) {
  const user = await User.findById(userId);
  if (!user) return null;

  const userCart = user.cart || [];
  const updatedCartProducts = userCart.filter((cartItem) => {
    return !purchasedProducts.some((orderItem) => {
      return (
        cartItem.id.equals(orderItem.id) &&
        cartItem.quantity === orderItem.count
      );
    });
  });

  user.cart = updatedCartProducts;
  await user.save();
  return user;
}

async function sendOrderConfirmationEmailSafe({ user, order }) {
  if (!user?.email) return;
  try {
    const html = generateOrderConfirmationEmail(
      user.username || "Khách hàng",
      order._id,
      order.products,
      order.totalPrice
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

module.exports = {
  decreaseInventoryByLineItems,
  increaseInventoryByLineItems,
  decreaseUserCartQuantities,
  removeExactPurchasedItemsFromCart,
  sendOrderConfirmationEmailSafe,
};
