const router = require("express").Router();
const { verifyAccessToken, isStrictAdmin } = require("../../middlewares/verifyToken");
const CateControll = require("./controller");

router.post(
  "/addCate",
  [verifyAccessToken, isStrictAdmin],
  CateControll.createCategory
);
router.get("/", CateControll.getAllCate);
router.delete(
  "/:cateId",
  [verifyAccessToken, isStrictAdmin],
  CateControll.deleteCate
);
router.patch("/:cateId", [verifyAccessToken, isStrictAdmin], CateControll.changeCate);
router.get("/current/:cid", CateControll.getCurrentCate);

module.exports = router;
