const router = require("express").Router();
const { verifyAccessToken, isAdmin } = require("../../middlewares/verifyToken");
const CateControll = require("./controller");

router.post(
  "/addCate",
  [verifyAccessToken, isAdmin],
  CateControll.createCategory
);
router.get("/", [verifyAccessToken, isAdmin], CateControll.getAllCate);
router.delete(
  "/:cateId",
  [verifyAccessToken, isAdmin],
  CateControll.deleteCate
);
router.patch("/:cateId", [verifyAccessToken, isAdmin], CateControll.changeCate);

module.exports = router;
