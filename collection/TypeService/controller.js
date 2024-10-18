const TypeService = require("./model");
const { default: mongoose } = require("mongoose");
const asyncHandler = require("express-async-handler");

const createService = asyncHandler(async (req, res) => {
  const { nameService, description, price } = req.body;

  try {
    const existingService = await TypeService.findOne({ nameService });
    if (existingService) {
      return res.status(400).json({
        success: false,
        message: "Service already exists",
      });
    }

    const newService = await TypeService.create({
      nameService,
      description,
      price,
    });

    return res.status(201).json({
      success: true,
      message: "Service created successfully",
      data: newService,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error creating service",
      error: error.message,
    });
  }
});

const updateService = asyncHandler(async (req, res) => {
  const { serviceID } = req.params;
  const { nameService, description, price } = req.body;

  try {
    const updatedService = await TypeService.findByIdAndUpdate(
      serviceID,
      { nameService, description, price },
      { new: true }
    );

    if (!updatedService) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Service updated successfully",
      data: updatedService,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error updating service",
      error: error.message,
    });
  }
});

const deleteService = asyncHandler(async (req, res) => {
  const { serviceID } = req.params;

  try {
    const service = await TypeService.findByIdAndDelete(serviceID);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Service deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error deleting service",
      error: error.message,
    });
  }
});

const getAllServices = asyncHandler(async (req, res) => {
  try {
    const services = await TypeService.find();
    if (!services || services.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No services found",
      });
    }

    return res.status(200).json({
      success: true,
      data: services,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error retrieving services",
      error: error.message,
    });
  }
});

const getServiceById = asyncHandler(async (req, res) => {
  const { serviceID } = req.params;

  try {
    const service = await TypeService.findById(serviceID);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: service,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error retrieving service",
      error: error.message,
    });
  }
});

module.exports = {
  createService,
  updateService,
  deleteService,
  getAllServices,
  getServiceById,
};
