const Order = require("../collection/Order/model");

function buildOrderPopulateQuery(query) {
  return query
    .populate("OrderBy", "username email mobile")
    .populate({
      path: "coupon",
      model: "Voucher",
      select: "nameVoucher",
    });
}

async function getAllOrdersWithUser() {
  return buildOrderPopulateQuery(Order.find()).exec();
}

async function getOrderByIdWithRelations(orderID) {
  return buildOrderPopulateQuery(Order.findById(orderID)).exec();
}

async function getOrdersByUserWithRelations(userID) {
  return buildOrderPopulateQuery(Order.find({ OrderBy: userID })).exec();
}

module.exports = {
  getAllOrdersWithUser,
  getOrderByIdWithRelations,
  getOrdersByUserWithRelations,
};
