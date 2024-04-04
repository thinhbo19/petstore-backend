const router = require("express").Router();
const { verifyAccessToken, isAdmin } = require("../middlewares/verifyToken");
const FoodControls = require("../controllers/food");

router.post(
  "/addFood",
  //   [verifyAccessToken, isAdmin],
  FoodControls.createFood
);

module.exports = router;
