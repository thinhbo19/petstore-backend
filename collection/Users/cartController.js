const asyncHandler = require("express-async-handler");
const Pet = require("../Pets/model");
const Product = require("../Product/model");
const { generateSlug } = require("../../service/slugifyConfig");
const {
  getUserByIdOrThrow,
  sendUserServerError,
} = require("./controllerShared");

const getSellableItemInfo = async (id) => {
  let item = await Pet.findById(id);
  let type = "Pet";
  if (!item) {
    item = await Product.findById(id);
    type = "Product";
  }
  if (!item) {
    return { error: "Item not found in Pet or Product collections" };
  }

  const stock = Math.max(0, Number(item.quantity) || 0);
  const isSold = Boolean(item.sold);
  if (isSold || stock <= 0) {
    return {
      error: `${type} is out of stock`,
      item,
      type,
      stock: 0,
    };
  }

  return { item, type, stock };
};

const getCarts = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  try {
    const user = await getUserByIdOrThrow(_id);
    res.status(200).json({
      success: true,
      cart: user.cart,
    });
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({ message: error.message });
    }
    console.error("Error while fetching cart:", error);
    return res
      .status(500)
      .json({ message: "An error occurred while fetching cart" });
  }
});

const shoppingCart = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const { id, quantity } = req.body;

  try {
    const user = await getUserByIdOrThrow(_id);
    let images;
    let displayInfo;

    const desiredQuantity = Math.floor(Number(quantity));
    if (!desiredQuantity || desiredQuantity <= 0) {
      return res.status(400).json({ message: "Invalid quantity value" });
    }

    const sellable = await getSellableItemInfo(id);
    if (sellable.error) {
      return res
        .status(400)
        .json({ success: false, message: sellable.error, maxAvailable: 0 });
    }
    const maxAvailable = sellable.stock;
    if (desiredQuantity > maxAvailable) {
      return res.status(400).json({
        success: false,
        message: `Số lượng vượt quá tồn kho hiện có (${maxAvailable})`,
        maxAvailable,
      });
    }

    const existingID = user.cart.findIndex((item) => item.id.toString() === id);

    if (existingID !== -1) {
      user.cart[existingID].quantity = desiredQuantity;
      user.cart[existingID].newPrice =
        user.cart[existingID].info.price * user.cart[existingID].quantity;

      await user.save();
      return res.status(200).json({
        cart: {
          id,
          info: user.cart[existingID].info,
          quantity: user.cart[existingID].quantity,
          newPrice: user.cart[existingID].newPrice,
          images: user.cart[existingID].images,
        },
        success: true,
        maxAvailable,
        message: "Quantity updated in your cart",
      });
    }

    const itemInfo = sellable.item;
    if (sellable.type === "Pet") {
      images = itemInfo.imgPet[0];
      displayInfo = {
        name: itemInfo.namePet,
        quantity: itemInfo.quantity,
        price: itemInfo.price,
        slug: `/shop/${generateSlug(
          itemInfo.petBreed.nameSpecies,
        )}/${generateSlug(itemInfo.petBreed.nameBreed)}/${generateSlug(
          itemInfo.namePet,
        )}`,
      };
    } else {
      images = itemInfo.images[0];
      displayInfo = {
        name: itemInfo.nameProduct,
        quantity: itemInfo.quantity,
        price: itemInfo.price,
        slug: `/accessory/${generateSlug(
          itemInfo.category.nameCate,
        )}/${generateSlug(itemInfo.nameProduct)}`,
      };
    }

    const newPrice = itemInfo.price * desiredQuantity;
    const newItem = {
      id,
      info: displayInfo,
      quantity: desiredQuantity,
      newPrice,
      images,
    };

    user.cart.push({
      id,
      info: displayInfo,
      quantity: desiredQuantity,
      newPrice,
      images,
    });
    await user.save();
    return res.status(201).json({
      success: true,
      message: "Successfully added to your cart",
      cart: newItem,
      maxAvailable,
    });
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({ message: error.message });
    }
    console.error("Error:", error);
    return res.status(500).json({ message: "An error occurred" });
  }
});

const updateCartQuantity = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const { id, quantity } = req.body;
  try {
    const desiredQuantity = Math.floor(Number(quantity));
    if (!desiredQuantity || desiredQuantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid quantity value",
      });
    }

    const user = await getUserByIdOrThrow(_id);
    const existingID = user.cart.findIndex((item) => item.id.toString() === id);
    if (existingID === -1) {
      return res.status(404).json({
        message: "Item not found in your cart",
        success: false,
      });
    }

    const sellable = await getSellableItemInfo(id);
    if (sellable.error) {
      return res
        .status(400)
        .json({ success: false, message: sellable.error, maxAvailable: 0 });
    }
    const maxAvailable = sellable.stock;
    if (desiredQuantity > maxAvailable) {
      return res.status(400).json({
        success: false,
        message: `Số lượng vượt quá tồn kho hiện có (${maxAvailable})`,
        maxAvailable,
      });
    }

    user.cart[existingID].quantity = desiredQuantity;
    user.cart[existingID].newPrice =
      user.cart[existingID].info.price * user.cart[existingID].quantity;
    await user.save();
    return res.status(200).json({
      message: "Cart quantity updated successfully",
      success: true,
      maxAvailable,
      cart: {
        id,
        quantity: user.cart[existingID].quantity,
      },
    });
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({ message: error.message, success: false });
    }
    return sendUserServerError(res, "An error occurred", { error });
  }
});

const deleteOneCart = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const { id } = req.body;

  if (!_id) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  if (!id) {
    return res.status(400).json({ success: false, message: "Missing cart item id" });
  }

  const user = await getUserByIdOrThrow(_id);
  const existingID = user.cart.findIndex((item) => String(item.id) === String(id));
  if (existingID === -1) {
    return res.status(404).json({ success: false, message: "Item not found in your cart" });
  }

  user.cart.splice(existingID, 1);
  await user.save();
  return res.status(200).json({ success: true, message: "Item removed from your cart" });
});

const deleteAllCart = asyncHandler(async (req, res) => {
  const { _id } = req.user;

  try {
    const user = await getUserByIdOrThrow(_id);
    user.cart = [];
    await user.save();

    return res.status(200).json({
      success: true,
      message: "All items removed from your cart",
    });
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({ success: false, message: error.message });
    }
    return sendUserServerError(
      res,
      "An error occurred while deleting all items in the cart",
      { error },
    );
  }
});

module.exports = {
  getCarts,
  shoppingCart,
  updateCartQuantity,
  deleteOneCart,
  deleteAllCart,
};
