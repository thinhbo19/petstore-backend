const asyncHandler = require("express-async-handler");
const User = require("./model");
const {
  createHttpError,
  getUserByIdOrThrow,
  sendUserServerError,
} = require("./controllerShared");

const addVoucher = asyncHandler(async (req, res) => {
  try {
    const { _id } = req.user;
    const { voucherId } = req.body;
    const user = await getUserByIdOrThrow(_id);
    const existingVoucher = user.Voucher.find(
      (voucher) => voucher.voucherID.toString() === voucherId,
    );
    if (existingVoucher) {
      return res
        .status(400)
        .json({ message: "Voucher already exists for this user." });
    }
    user.Voucher.push({ voucherID: voucherId });
    await user.save();
    return res.status(200).json({ message: "Voucher added successfully!" });
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({ message: error.message });
    }
    return sendUserServerError(res, "An error", { includeSuccess: false, error });
  }
});

const getVouchers = asyncHandler(async (req, res) => {
  try {
    const { _id } = req.user;
    const user = await User.findById(_id).populate("Voucher.voucherID");
    if (!user) throw createHttpError(404, "User not found");

    const currentDate = new Date();
    const validVouchers = user.Voucher.filter((voucher) => {
      const voucherExpiry = voucher.voucherID.expiry;
      return voucherExpiry && voucherExpiry > currentDate;
    }).map((voucher) => voucher.voucherID);

    return res.status(200).json({ vouchers: validVouchers });
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({ message: error.message });
    }
    console.error(error);
    return res
      .status(500)
      .json({ message: "An error occurred while retrieving the vouchers." });
  }
});

module.exports = {
  addVoucher,
  getVouchers,
};
