const mongoose = require("mongoose");

const permissionItemSchema = new mongoose.Schema(
  {
    method: { type: String, required: true, uppercase: true, trim: true },
    path: { type: String, required: true, trim: true },
    allowed: { type: Boolean, default: true },
  },
  { _id: false },
);

const rolePermissionSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    permissions: {
      type: [permissionItemSchema],
      default: [],
    },
    dashboardAccess: {
      type: Boolean,
      default: false,
    },
    dashboardMenus: {
      type: [String],
      default: [],
    },
    updatedBy: {
      type: mongoose.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("RolePermission", rolePermissionSchema);
