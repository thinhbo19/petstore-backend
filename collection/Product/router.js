const uploadCloud = require("../../middlewares/uploadimg");
const router = require("express").Router();
const productController = require("./controller");
const { verifyAccessToken, isAdmin } = require("../../middlewares/verifyToken");

router.post(
  "/addProduct",
  uploadCloud.array("images"),
  productController.createProduct
);
router.get("/", productController.getAllProduct);
router.get(
  "/currentProduct/:prodName",
  productController.getCurrentProductByName
);
router.get("/category/:nameCate", productController.findProductsByCategory);
router.get("/current/:prodid", productController.getCurrentProduct);
router.put(
  "/:productId",
  [verifyAccessToken, isAdmin],
  productController.changeProduct
);
router.delete(
  "/:productId",
  [verifyAccessToken, isAdmin],
  productController.deleteProduct
);
module.exports = router;
