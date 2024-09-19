const userRouter = require("./collection/Users/router");
const chatRouter = require("./collection/Chat/router");
const messRouter = require("./collection/Messager/router");
const petsRouter = require("./collection/Pets/router");
const petSpeciesRouter = require("./collection/PetSpecies/router");
const petBreedRouter = require("./collection/PetBreed/router");
const cateRouter = require("./collection/Category/router");
const productRouter = require("./collection/Product/router");
const typeServiceRouter = require("./collection/TypeService/router");
const bookingRouter = require("./collection/Booking/router");
const orderRouter = require("./collection/Order/router");
const voucherRouter = require("./collection/Voucher/router");

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
  app.use("/api/typeService", typeServiceRouter);
  app.use("/api/booking", bookingRouter);
  app.use("/api/order", orderRouter);
  app.use("/api/voucher", voucherRouter);

  app.use(notFound);
  app.use(errHandle);
};

module.exports = initRouter;
