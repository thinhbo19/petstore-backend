const mongoose = require("mongoose");

const dbconnect = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    if (conn.connection.readyState === 1) {
      console.log("DB connection is successfully");
    } else {
      console.log("DB connection is failed");
    }
  } catch (error) {
    console.log("DB connection is failed");
    throw new Error(error);
  }
};

module.exports = dbconnect;
