const jwt = require("jsonwebtoken");

const generateAccessToken = (userId, role, expiresIn = "1d") =>
  jwt.sign({ _id: userId, role }, process.env.JWT_SECRET, { expiresIn });

const generateRefreshToken = (userId, rememberMe = false) =>
  jwt.sign({ _id: userId, rememberMe }, process.env.JWT_SECRET, {
    expiresIn: rememberMe ? "5d" : "1d",
  });

module.exports = {
  generateAccessToken,
  generateRefreshToken,
};
