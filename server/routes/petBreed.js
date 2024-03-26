const router = require("express").Router();
const petBreedControls = require("../controllers/petBreed");
const { verifyAccessToken, isAdmin } = require("../middlewares/verifyToken");

router.post("/addNewBreed", petBreedControls.createNewBreed);
router.get("/getAllBreed", petBreedControls.getAllPetBreed);
router.put("/changeBreed/:bid", petBreedControls.changePetBreed);
router.delete("/:bid", petBreedControls.deletePetBreed);
module.exports = router;
