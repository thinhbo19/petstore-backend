const asyncHandler = require("express-async-handler");
const {
  getUserByIdOrThrow,
  ensureAddressIndexOrThrow,
  sendUserServerError,
} = require("./controllerShared");

const addAddress = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const { address } = req.body;
  try {
    const user = await getUserByIdOrThrow(_id);
    user.Address.push({ address: address, settingDefault: false });
    await user.save();

    return res.status(201).json({ success: true, message: "Address added successfully" });
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({ success: false, message: error.message });
    }
    return sendUserServerError(res, "An error occurred while adding address", {
      error,
    });
  }
});

const deleteAddress = async (req, res) => {
  const { _id } = req.user;
  const addressIndex = req.params.addressIndex;

  try {
    const user = await getUserByIdOrThrow(_id);
    const idx = ensureAddressIndexOrThrow(user, addressIndex);
    user.Address.splice(idx, 1);
    await user.save();

    return res.status(200).json({ success: true, message: "Address deleted successfully" });
  } catch (error) {
    if (error.status === 404 || error.status === 400) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    return sendUserServerError(res, "An error occurred while deleting address", {
      error,
    });
  }
};

const changeAddress = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const { addressIndex } = req.params;
  const { address } = req.body;

  try {
    const user = await getUserByIdOrThrow(_id);
    const idx = ensureAddressIndexOrThrow(user, addressIndex);
    user.Address[idx].address = address;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Address updated successfully",
    });
  } catch (error) {
    if (error.status === 404 || error.status === 400) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    return sendUserServerError(res, "An error occurred while updating address", {
      error,
      logLabel: "Error updating address",
    });
  }
});

const changeDefaultAddress = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const { addressIndex } = req.params;

  try {
    const user = await getUserByIdOrThrow(_id);
    const idx = ensureAddressIndexOrThrow(user, addressIndex);
    user.Address.forEach((address) => {
      address.settingDefault = false;
    });
    user.Address[idx].settingDefault = true;
    await user.save();
    return res.status(200).json({ message: "Default address changed successfully" });
  } catch (error) {
    if (error.status === 404 || error.status === 400) {
      return res.status(error.status).json({ message: error.message });
    }
    return sendUserServerError(res, "An error occurred while changing default address", {
      includeSuccess: false,
      error,
    });
  }
});

module.exports = {
  addAddress,
  deleteAddress,
  changeAddress,
  changeDefaultAddress,
};
