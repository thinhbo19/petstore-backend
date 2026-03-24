const uploadCloud = require("../../middlewares/uploadimg");
const router = require("express").Router();
const productController = require("./controller");
const {
  verifyAccessToken,
  isStrictAdmin,
} = require("../../middlewares/verifyToken");
const prodpetSer = require("../../service/ProdAndPet");

router.post(
  "/addProduct",
  [verifyAccessToken, isStrictAdmin],
  uploadCloud.array("images"),
  productController.createProduct
);
router.get("/", productController.getAllProduct);
router.get("/next/:pid", productController.getNextData);
router.get(
  "/currentProduct/:prodName",
  productController.getCurrentProductByName
);
router.get("/category/:id", productController.findProductsByCategory);
router.get("/current/:prodid", productController.getCurrentProduct);
router.put(
  "/:productId",
  [verifyAccessToken, isStrictAdmin],
  productController.changeProduct
);
router.delete(
  "/:productId",
  [verifyAccessToken, isStrictAdmin],
  productController.deleteProduct
);
router.get("/prodpets/:pid", prodpetSer.getData);
router.post(
  "/rating/:prodId",
  [verifyAccessToken],
  uploadCloud.array("feedback_img"),
  productController.postRating
);

module.exports = router;
