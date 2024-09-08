const uploadCloud = require("../../middlewares/uploadimg");
const router = require("express").Router();
const newsControlls = require("./controler");
const { verifyAccessToken, isAdmin } = require("../../middlewares/verifyToken");

router.post(
  "/addNews",
  [verifyAccessToken, isAdmin],
  uploadCloud.array("image"),
  newsControlls.createNews
);

router.get("/", newsControlls.getAllNews);
router.get("/:nid", newsControlls.getCurrentNews);
router.put(
  "/:nid",
  [verifyAccessToken, isAdmin],
  uploadCloud.array("image"),
  newsControlls.changeNews
);
router.delete("/:nid", [verifyAccessToken, isAdmin], newsControlls.deleteNews);
router.get("/:nName", newsControlls.getCurrentNewsByName);

module.exports = router;
