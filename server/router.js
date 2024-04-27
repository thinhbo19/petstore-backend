const userRouter = require("./collection/Users/router");
const petsRouter = require("./collection/Pets/router");
const petSpeciesRouter = require("./collection/PetSpecies/router");
const petBreedRouter = require("./collection/PetBreed/router");
const foodRouter = require("./collection/Food/router");
const toyRouter = require("./collection/Toys/router");
const brandRouter = require("./collection/Brand/router");
const { notFound, errHandle } = require("./middlewares/errHandler");

const initRouter = (app) => {
  app.use("/api/user", userRouter);
  app.use("/api/pets", petsRouter);
  app.use("/api/petSpecies", petSpeciesRouter);
  app.use("/api/petBreed", petBreedRouter);
  app.use("/api/petFood", foodRouter);
  app.use("/api/petToys", toyRouter);
  app.use("/api/brand", brandRouter);

  app.use(notFound);
  app.use(errHandle);
};

module.exports = initRouter;
