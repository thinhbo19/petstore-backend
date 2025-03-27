const uploadCloud = require("../../middlewares/uploadimg");
const router = require("express").Router();
const productController = require("./controller");
const { verifyAccessToken, isAdmin } = require("../../middlewares/verifyToken");
const prodpetSer = require("../../service/ProdAndPet");

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
router.get("/category/:id", productController.findProductsByCategory);
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
router.get("/prodpets/:pid", prodpetSer.getData);
router.post(
  "/rating/:prodId",
  uploadCloud.array("feedback_img"),
  productController.postRating
);

module.exports = router;
