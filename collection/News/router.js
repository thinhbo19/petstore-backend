const uploadCloud = require("../../middlewares/uploadimg");
const router = require("express").Router();
const newsControlls = require("./controller");
const {
  verifyAccessToken,
  isStrictAdmin,
} = require("../../middlewares/verifyToken");

router.post(
  "/addNews",
  [verifyAccessToken, isStrictAdmin],
  uploadCloud.array("image"),
  newsControlls.createNews
);

router.get("/", newsControlls.getAllNews);
router.put(
  "/:nid",
  [verifyAccessToken, isStrictAdmin],
  uploadCloud.array("image"),
  newsControlls.changeNews
);
router.delete("/:nid", [verifyAccessToken, isStrictAdmin], newsControlls.deleteNews);
router.get("/current/:nName", newsControlls.getCurrentNewsByName);
router.get("/:nid", newsControlls.getCurrentNews);

module.exports = router;
