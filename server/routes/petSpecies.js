const router = require("express").Router();
const petSpeciesControls = require("../controllers/petSpecies");
const { verifyAccessToken, isAdmin } = require("../middlewares/verifyToken");

router.post(
  "/addNewSpecies",
  [verifyAccessToken, isAdmin],
  petSpeciesControls.createNewPetSpecies
);
router.get(
  "/getAllSpecies",
  [verifyAccessToken, isAdmin],
  petSpeciesControls.getAllPetSpecies
);
router.put(
  "/changeSpecies/:psid",
  [verifyAccessToken, isAdmin],
  petSpeciesControls.changePetSpecies
);

router.delete(
  "/:psid",
  [verifyAccessToken, isAdmin],
  petSpeciesControls.deletePetSpecies
);

module.exports = router;
