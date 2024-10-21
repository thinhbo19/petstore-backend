const router = require("express").Router();
const { verifyAccessToken, isAdmin } = require("../../middlewares/verifyToken");
const voucherController = require("./controller");

router.post("/voucher", voucherController.addVoucher);
router.delete("/voucher/:id", voucherController.deleteVoucher);
router.put("/voucher/:id", voucherController.updateVoucher);
router.get("/voucher", voucherController.getAllVouchers);
router.get("/voucher/:id", voucherController.getVoucherById);

module.exports = router;
