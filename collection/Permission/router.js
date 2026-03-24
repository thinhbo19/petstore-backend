const router = require("express").Router();
const {
  getRoles,
  createRolePermission,
  getPermissionsByRole,
  updatePermissionsByRole,
  deleteRolePermission,
} = require("./controller");
const { verifyAccessToken, isStrictAdmin } = require("../../middlewares/verifyToken");

router.get("/roles", [verifyAccessToken, isStrictAdmin], getRoles);
router.post("/roles", [verifyAccessToken, isStrictAdmin], createRolePermission);
router.get("/:role", [verifyAccessToken, isStrictAdmin], getPermissionsByRole);
router.put("/:role", [verifyAccessToken, isStrictAdmin], updatePermissionsByRole);
router.delete("/:role", [verifyAccessToken, isStrictAdmin], deleteRolePermission);

module.exports = router;
