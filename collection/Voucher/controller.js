const Voucher = require("./model");
const { default: mongoose } = require("mongoose");
const asyncHandler = require("express-async-handler");

const addVoucher = asyncHandler(async (req, res) => {
  try {
    const { nameVoucher, discount, exclusive, expiry } = req.body;

    // Tạo một voucher mới
    const newVoucher = new Voucher({
      nameVoucher,
      discount,
      exclusive,
      expiry,
    });

    // Lưu vào cơ sở dữ liệu
    await newVoucher.save();

    res.status(201).json({
      success: true,
      message: "Voucher created successfully!",
      data: newVoucher,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating voucher",
      error: error.message,
    });
  }
});
const deleteVoucher = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    // Tìm và xóa voucher theo ID
    const deletedVoucher = await Voucher.findByIdAndDelete(id);

    if (!deletedVoucher) {
      return res.status(404).json({
        success: false,
        message: "Voucher not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Voucher deleted successfully!",
      data: deletedVoucher,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting voucher",
      error: error.message,
    });
  }
});
const updateVoucher = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { nameVoucher, discount, exclusive, expiry } = req.body;

    // Tìm và cập nhật voucher
    const updatedVoucher = await Voucher.findByIdAndUpdate(
      id,
      { nameVoucher, discount, exclusive, expiry },
      { new: true } // Để trả về object sau khi cập nhật
    );

    if (!updatedVoucher) {
      return res.status(404).json({
        success: false,
        message: "Voucher not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Voucher updated successfully!",
      data: updatedVoucher,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating voucher",
      error: error.message,
    });
  }
});
const getAllVouchers = asyncHandler(async (req, res) => {
  try {
    const vouchers = await Voucher.find();
    res.status(200).json({
      success: true,
      data: vouchers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching vouchers",
      error: error.message,
    });
  }
});
const getVoucherById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const voucher = await Voucher.findById(id);

    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: "Voucher not found",
      });
    }

    res.status(200).json({
      success: true,
      data: voucher,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching voucher",
      error: error.message,
    });
  }
});

module.exports = {
  addVoucher,
  deleteVoucher,
  updateVoucher,
  getAllVouchers,
  getVoucherById,
};
