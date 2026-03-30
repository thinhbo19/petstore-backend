const asyncHandler = require("express-async-handler");
const Settings = require("./model");

const SETTINGS_KEY = "admin_settings";

const defaultSettings = {
  storeName: "PetShop Pro",
  storeDescription: "Cua hang thu cung chat luong cao",
  contactEmail: "info@petshoppro.com",
  contactPhone: "0123456789",
  address: "123 Duong ABC, Quan 1, TP.HCM",
  businessHours: "8:00 - 22:00 (Thu 2 - Chu nhat)",
  currency: "VND",
  language: "vi",
  maintenanceMode: false,
  emailNotifications: true,
  smsNotifications: false,
};

const getSettings = asyncHandler(async (_req, res) => {
  const found = await Settings.findOne({ key: SETTINGS_KEY }).lean();
  return res.status(200).json({
    success: true,
    data: found?.data || defaultSettings,
  });
});

const updateSettings = asyncHandler(async (req, res) => {
  const payload = req.body || {};
  const merged = { ...defaultSettings, ...payload };
  const updated = await Settings.findOneAndUpdate(
    { key: SETTINGS_KEY },
    { key: SETTINGS_KEY, data: merged },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return res.status(200).json({
    success: true,
    message: "Settings updated successfully",
    data: updated.data,
  });
});

module.exports = {
  getSettings,
  updateSettings,
};
