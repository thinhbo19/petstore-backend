const User = require("../Users/model");
const TypeService = require("./model");
const { default: mongoose } = require("mongoose");
const asyncHandler = require("express-async-handler");

const createService = asyncHandler(async (req, res) => {
  const { nameService, type, description, price } = req.body;

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
      type,
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
  const { nameService, type, description, price } = req.body;

  try {
    const updatedService = await TypeService.findByIdAndUpdate(
      serviceID,
      { nameService, type, description, price },
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

const getAllSpaServices = asyncHandler(async (req, res) => {
  try {
    const services = await TypeService.find({ type: "Spa" });
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

const getAllHotelServices = asyncHandler(async (req, res) => {
  try {
    const services = await TypeService.find({ type: "Hotel" });
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

const postRating = asyncHandler(async (req, res) => {
  try {
    const { postBy, star, comment } = req.body;

    const feedback_img = req.files.map((file) => file.path);

    const { serId } = req.params;

    const service = await TypeService.findById(serId);
    const user = await User.findById(postBy);

    if (!service) {
      throw new Error("Service not found");
    }
    if (!user) {
      throw new Error("user not found");
    }
    if (!postBy || !star || !comment) {
      res.status(400);
      throw new Error(
        "Please provide complete information: postBy, star, comment."
      );
    }

    if (star < 1 || star > 5) {
      res.status(400);
      throw new Error("The number of stars must be between 1 and 5.");
    }

    const existingRatingIndex = service.rating.findIndex(
      (r) => r.postBy.toString() === postBy
    );
    if (existingRatingIndex !== -1) {
      service.rating[existingRatingIndex] = {
        postBy,
        username: user.username,
        avatar: user.Avatar,
        star,
        comment,
        dateComment: Date.now(),
        feedback_img: feedback_img,
      };
    } else {
      service.rating.push({
        postBy,
        username: user.username,
        avatar: user.Avatar,
        star,
        comment,
        dateComment: Date.now(),
        feedback_img: feedback_img,
      });
    }
    await service.save();
    if (existingRatingIndex !== -1) {
      res.status(200).json({
        success: true,
        message: "Rating updated successfully.",
        service,
      });
    } else {
      res.status(200).json({
        success: true,
        message: "Rating added successfully.",
        service,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      mess: error.message,
    });
  }
});

const deleteRating = asyncHandler(async (req, res) => {
  try {
    const { serId } = req.params;
    const { postBy } = req.body;

    const service = await TypeService.findById(serId); // Tìm thú cưng theo ID

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    const existingRatingIndex = service.rating.findIndex(
      (r) => r.postBy.toString() === postBy
    );

    if (!existingRatingIndex) {
      return res.status(404).json({
        success: false,
        message: "Rating not found",
      });
    }

    service.rating.splice(existingRatingIndex, 1);
    await service.save();

    return res.status(200).json({
      success: true,
      message: "Rating deleted successfully.",
      service,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = {
  createService,
  updateService,
  deleteService,
  getAllServices,
  getAllSpaServices,
  getAllHotelServices,
  getServiceById,
  postRating,
  deleteRating,
};
