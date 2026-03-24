const router = require("express").Router();
const petSpeciesControls = require("./controller");
const { verifyAccessToken, isStrictAdmin } = require("../../middlewares/verifyToken");

router.post(
  "/addNewSpecies",
  [verifyAccessToken, isStrictAdmin],
  petSpeciesControls.createNewPetSpecies
);
router.get("/getAllSpecies", petSpeciesControls.getAllPetSpecies);
router.put(
  "/changeSpecies/:psid",
  [verifyAccessToken, isStrictAdmin],
  petSpeciesControls.changePetSpecies
);
router.delete(
  "/:psid",
  [verifyAccessToken, isStrictAdmin],
  petSpeciesControls.deletePetSpecies
);

module.exports = router;
