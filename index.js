require("dotenv").config();
const express = require("express");
const dbConnect = require("./config/dbconnect");
const initRouters = require("./router");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const app = express();

app.use(
  cors({
    origin: process.env.URL_CLIENT,
    methods: ["POST", "PUT", "GET", "DELETE", "PATCH"],
  })
);

app.use(cookieParser());
const port = process.env.PORT || 8888;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
dbConnect();

initRouters(app);

app.listen(port, () => {
  console.log("Server running: " + port);
});
