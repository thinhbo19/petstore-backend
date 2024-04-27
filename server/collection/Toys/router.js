const router = require("express").Router();
const { verifyAccessToken, isAdmin } = require("../../middlewares/verifyToken");
const ToyControls = require("./controller");

router.post(
  "/addToy",
  //   [verifyAccessToken, isAdmin],
  ToyControls.createToys
);

module.exports = router;
