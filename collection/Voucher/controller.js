const Voucher = require("./model");
const { default: mongoose } = require("mongoose");
const asyncHandler = require("express-async-handler");
const moment = require("moment");

const addVoucher = asyncHandler(async (req, res) => {
  try {
    const time = 24 * 60 * 60 * 1000;
    const { nameVoucher, typeVoucher, discount, exclusive, expiry } = req.body;

    const newVoucher = new Voucher({
      nameVoucher,
      typeVoucher,
      discount,
      exclusive,
      expiry: Date.now() + +expiry * time,
    });

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
    const { nameVoucher, typeVoucher, discount, exclusive, expiry } = req.body;
    const time = 24 * 60 * 60 * 1000;

    const updatedVoucher = await Voucher.findByIdAndUpdate(
      id,
      {
        nameVoucher,
        typeVoucher,
        discount,
        exclusive,
        expiry: Date.now() + +expiry * time,
      },
      { new: true }
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

    const formattedVouchers = vouchers.map((voucher) => ({
      ...voucher.toObject(),
      expiry: moment(voucher.expiry).format("YYYY-MM-DD"),
    }));

    res.status(200).json({
      success: true,
      data: formattedVouchers,
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
      data: {
        ...voucher.toObject(),
        expiry: moment(voucher.expiry).format("YYYY-MM-DD"),
      },
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
