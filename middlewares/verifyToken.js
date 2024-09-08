const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");

const verifyAccessToken = asyncHandler(async (req, res, next) => {
  const authorizationHeader = req.headers.authorization;

  if (!authorizationHeader || !authorizationHeader.startsWith("Bearer")) {
    return res.status(401).json({
      success: false,
      message: "Missing or invalid authorization header",
    });
  }

  const token = authorizationHeader.split(" ")[1];

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Token has expired",
        });
      }
      return res.status(401).json({
        success: false,
        message: "Invalid access token",
      });
    }
    req.user = decoded;
    next();
  });
});
const isAdmin = asyncHandler(async (req, res, next) => {
  const { role } = req.user;
  if (role !== "Admin" && role !== "Staff")
    return res.status(401).json({
      success: false,
      message: "You are not admin or customer!!!!!",
    });
  next();
});

module.exports = {
  verifyAccessToken,
  isAdmin,
};
