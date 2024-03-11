const userRouter = require("./user");

const initRouter = (app) => {
  app.use("/api/user", userRouter);
};

module.exports = initRouter;
