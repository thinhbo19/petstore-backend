const router = require("express").Router();
const petsControlls = require("../controllers/pets");
const { verifyAccessToken, isAdmin } = require("../middlewares/verifyToken");

router.post(
  "/addPets",
  [verifyAccessToken, isAdmin],
  petsControlls.createNewPets
);
router.get("/allPet", [verifyAccessToken, isAdmin], petsControlls.getAllPets);
router.delete("/:pid", [verifyAccessToken, isAdmin], petsControlls.deletePet);
router.put("/:pid", [verifyAccessToken, isAdmin], petsControlls.changePets);
router.get("/current/:pid", petsControlls.getCurrentPets);

module.exports = router;
