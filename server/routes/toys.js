const router = require("express").Router();
const { verifyAccessToken, isAdmin } = require("../middlewares/verifyToken");
const ToyControls = require("../controllers/toys");

router.post(
  "/addToy",
  //   [verifyAccessToken, isAdmin],
  ToyControls.createToys
);

module.exports = router;
