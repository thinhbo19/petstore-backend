const uploadCloud = require("../../middlewares/uploadimg");
const router = require("express").Router();
const productController = require("./controller");
const { verifyAccessToken, isAdmin } = require("../../middlewares/verifyToken");

router.post(
  "/addProduct",
  uploadCloud.array("images"),
  productController.createProduct
);

module.exports = router;
