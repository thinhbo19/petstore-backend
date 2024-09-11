const userRouter = require("./collection/Users/router");
const chatRouter = require("./collection/Chat/router");
const messRouter = require("./collection/Messager/router");
const petsRouter = require("./collection/Pets/router");
const petSpeciesRouter = require("./collection/PetSpecies/router");
const petBreedRouter = require("./collection/PetBreed/router");
const cateRouter = require("./collection/Category/router");
const productRouter = require("./collection/Product/router");
const newsRouter = require("./collection/News/router");
const { notFound, errHandle } = require("./middlewares/errHandler");

const initRouter = (app) => {
  app.use("/api/user", userRouter);
  app.use("/api/chat", chatRouter);
  app.use("/api/mess", messRouter);
  app.use("/api/pets", petsRouter);
  app.use("/api/petSpecies", petSpeciesRouter);
  app.use("/api/petBreed", petBreedRouter);
  app.use("/api/cate", cateRouter);
  app.use("/api/product", productRouter);
  app.use("/api/news", newsRouter);

  app.use(notFound);
  app.use(errHandle);
};

module.exports = initRouter;
