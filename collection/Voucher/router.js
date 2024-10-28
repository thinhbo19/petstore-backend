const router = require("express").Router();
const { verifyAccessToken, isAdmin } = require("../../middlewares/verifyToken");
const voucherController = require("./controller");

router.post("/", [verifyAccessToken, isAdmin], voucherController.addVoucher);
router.delete(
  "/:id",
  [verifyAccessToken, isAdmin],
  voucherController.deleteVoucher
);
router.put(
  "/:id",
  [verifyAccessToken, isAdmin],
  voucherController.updateVoucher
);
router.get("/", voucherController.getAllVouchers);
router.get("/:id", voucherController.getVoucherById);
module.exports = router;
