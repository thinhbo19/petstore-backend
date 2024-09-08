const jwt = require("jsonwebtoken");

const generateAccessToken = (userId, role) =>
  jwt.sign({ _id: userId, role }, process.env.JWT_SECRET, { expiresIn: "5d" });

const generateRefreshToken = (userId) =>
  jwt.sign({ _id: userId }, process.env.JWT_SECRET, { expiresIn: "10d" });

module.exports = {
  generateAccessToken,
  generateRefreshToken,
};
