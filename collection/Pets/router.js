const uploadCloud = require("../../middlewares/uploadimg");
const router = require("express").Router();
const petsControlls = require("./controller");
const {
  verifyAccessToken,
  isStrictAdmin,
} = require("../../middlewares/verifyToken");

router.post(
  "/addPets",
  [verifyAccessToken, isStrictAdmin],
  uploadCloud.array("imgPet"),
  petsControlls.createNewPets
);
router.get("/allPets", petsControlls.getAllPets);
router.get("/next/:pid", petsControlls.getNextData);
router.delete("/:pid", [verifyAccessToken, isStrictAdmin], petsControlls.deletePet);
router.put("/:pid", [verifyAccessToken, isStrictAdmin], petsControlls.changePets);
router.get("/current/:pid", petsControlls.getCurrentPets);
router.get("/currentPet/:pName", petsControlls.getCurrentPetsByName);

router.get("/getPetByBreed/:breed", petsControlls.getPetByBreed);
router.get("/getPetBySpecies/:specie", petsControlls.getPetBySpecies);
router.get("/sortPet/:breed", petsControlls.sortingPet);
router.get("/filterPrice/:breed", petsControlls.filterPricePet);

router.post(
  "/rating/:petId",
  [verifyAccessToken],
  uploadCloud.array("feedback_img"),
  petsControlls.postRating
);
router.delete("/rating/:petId", [verifyAccessToken], petsControlls.deleteRating);

module.exports = router;
