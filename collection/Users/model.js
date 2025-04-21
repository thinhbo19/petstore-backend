const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

var userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      unique: true,
      required: true,
    },
    mobile: {
      type: String,
    },
    password: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
    },
    Avatar: {
      type: String,
      default: "",
    },
    role: {
      type: String,
      default: "User",
      enum: ["Admin", "User", "Staff"],
    },
    cart: [
      {
        id: { type: mongoose.Types.ObjectId },
        info: { type: Object },
        quantity: { type: Number },
        newPrice: { type: Number },
        images: { type: String },
        createAt: { type: Date, default: Date.now() },
      },
    ],

    Address: [
      {
        type: String,
      },
    ],
    Voucher: [
      {
        voucherID: {
          type: mongoose.Types.ObjectId,
          require: true,
          ref: "Voucher",
        },
      },
    ],
    favorites: [
      {
        id: {
          type: mongoose.Types.ObjectId,
          ref: "Pets",
        },
        img: { type: String },
        name: { type: String },
        price: { type: Number },
        type: { type: String },
        url: { type: String },
        createAt: { type: Date, default: Date.now() },
      },
    ],
    isBlocked: {
      type: Boolean,
      default: false,
    },
    refreshToken: {
      type: String,
    },
    passwordChangeAt: {
      type: String,
    },
    passwordResetToken: {
      type: String,
    },
    passwordResetExpire: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre("save", async function (next) {
  try {
    if (!this.isModified("password")) {
      return next();
    }

    const salt = bcrypt.genSaltSync(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods = {
  isCorrectPassword: async function (password) {
    return await bcrypt.compare(password, this.password);
  },
  createPasswordChangeToken: function () {
    const resetToken = crypto.randomBytes(32).toString("hex");
    this.passwordResetToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    this.passwordResetExpire = Date.now() + 15 * 60 * 1000;
    return resetToken;
  },
};

module.exports = mongoose.model("User", userSchema);
