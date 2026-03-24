const router = require("express").Router();
const { verifyAccessToken, isStrictAdmin } = require("../../middlewares/verifyToken");
const voucherController = require("./controller");

router.post("/", [verifyAccessToken, isStrictAdmin], voucherController.addVoucher);
router.delete(
  "/:id",
  [verifyAccessToken, isStrictAdmin],
  voucherController.deleteVoucher
);
router.put(
  "/:id",
  [verifyAccessToken, isStrictAdmin],
  voucherController.updateVoucher
);
router.get("/", voucherController.getAllVouchers);
router.get("/client", voucherController.getVouchersForClient);
router.get("/:id", voucherController.getVoucherById);
module.exports = router;
