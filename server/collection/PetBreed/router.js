const router = require("express").Router();
const petBreedControls = require("./controller");
const { verifyAccessToken, isAdmin } = require("../../middlewares/verifyToken");

router.post(
  "/addNewBreed",
  //[verifyAccessToken, isAdmin],
  petBreedControls.createNewBreed
);
router.get(
  "/getAllBreed",
  [verifyAccessToken, isAdmin],
  petBreedControls.getAllPetBreed
);
router.put(
  "/changeBreed/:bid",
  // [verifyAccessToken, isAdmin],
  petBreedControls.changePetBreed
);
router.delete(
  "/:bid",
  [verifyAccessToken, isAdmin],
  petBreedControls.deletePetBreed
);
module.exports = router;
