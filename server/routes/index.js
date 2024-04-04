const userRouter = require("./user");
const petsRouter = require("./pets");
const petSpeciesRouter = require("./petSpecies");
const petBreedRouter = require("./petBreed");
const foodRouter = require("./food");
const toyRouter = require("./toys");
const { notFound, errHandle } = require("../middlewares/errHandler");

const initRouter = (app) => {
  app.use("/api/user", userRouter);
  app.use("/api/pets", petsRouter);
  app.use("/api/petSpecies", petSpeciesRouter);
  app.use("/api/petBreed", petBreedRouter);
  app.use("/api/petFood", foodRouter);
  app.use("/api/petToys", toyRouter);

  app.use(notFound);
  app.use(errHandle);
};

module.exports = initRouter;
