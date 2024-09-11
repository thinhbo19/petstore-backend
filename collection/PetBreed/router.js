const router = require("express").Router();
const petBreedControls = require("./controller");
const { verifyAccessToken, isAdmin } = require("../../middlewares/verifyToken");
const uploadCloud = require("../../middlewares/uploadimg");

router.post(
  "/addNewBreed",
  uploadCloud.array("imgBreed"),
  [verifyAccessToken, isAdmin],
  petBreedControls.createNewBreed
);
router.get("/getAllBreed", petBreedControls.getAllPetBreed);
router.get("/getCurrentBreed/:bid", petBreedControls.getCurrentBreed);
router.put(
  "/changeBreed/:bid",
  [verifyAccessToken, isAdmin],
  petBreedControls.changePetBreed
);
router.delete(
  "/:bid",
  [verifyAccessToken, isAdmin],
  petBreedControls.deletePetBreed
);
router.get("/getBreedBySpecies/:species", petBreedControls.getBreedBySpecies);
router.get(
  "/getBreedByNameSpecies/:nameSpecies",
  petBreedControls.getBreedByNameSpecies
);
router.get("/sortBreed/:species", petBreedControls.sortingBreed);
module.exports = router;
