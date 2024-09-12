const uploadCloud = require("../../middlewares/uploadimg");
const router = require("express").Router();
const petsControlls = require("./controller");
const { verifyAccessToken, isAdmin } = require("../../middlewares/verifyToken");

router.post(
  "/addPets",
  [verifyAccessToken, isAdmin],
  uploadCloud.array("imgPet"),
  petsControlls.createNewPets
);
router.get("/allPets", petsControlls.getAllPets);
router.delete("/:pid", [verifyAccessToken, isAdmin], petsControlls.deletePet);
router.put(
  "/:pid",
  uploadCloud.array("imgPet"),
  [verifyAccessToken, isAdmin],
  petsControlls.changePets
);
router.get("/current/:pid", petsControlls.getCurrentPets);
router.get("/currentPet/:pName", petsControlls.getCurrentPetsByName);

router.get("/getPetByBreed/:breed", petsControlls.getPetByBreed);
router.get("/sortPet/:breed", petsControlls.sortingPet);
router.get("/filterPrice/:breed", petsControlls.filterPricePet);
module.exports = router;
