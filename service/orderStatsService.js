const Order = require("../collection/Order/model");
const User = require("../collection/Users/model");

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

async function calculateTotalPriceAllOrders() {
  const orders = await Order.find();
  if (!orders || orders.length === 0) {
    return { found: false, totalPrice: 0 };
  }
  const totalPrice = orders.reduce((total, order) => total + (order.totalPrice || 0), 0);
  return { found: true, totalPrice };
}

async function getMostPurchasedProducts(limit = 7) {
  const productsAggregation = await Order.aggregate([
    { $unwind: "$products" },
    {
      $group: {
        _id: "$products.id",
        totalPurchased: { $sum: "$products.count" },
        productName: { $first: "$products.name" },
        prodImg: { $first: "$products.img" },
      },
    },
    { $sort: { totalPurchased: -1 } },
    { $limit: limit },
  ]);
  return productsAggregation.map((product) => ({
    id: product._id,
    name: product.productName,
    totalPurchased: product.totalPurchased,
    img: product.prodImg,
  }));
}

async function getTotalSalesByMonth(year) {
  const selectedYear = parseInt(year, 10);
  const salesAggregation = await Order.aggregate([
    {
      $project: {
        totalPrice: 1,
        month: { $month: "$createdAt" },
        year: { $year: "$createdAt" },
      },
    },
    { $match: { year: selectedYear } },
    {
      $group: {
        _id: { month: "$month" },
        totalSales: { $sum: "$totalPrice" },
      },
    },
    { $sort: { "_id.month": 1 } },
  ]);

  const monthlySales = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    totalSales: 0,
  }));
  salesAggregation.forEach((sale) => {
    const monthIndex = sale._id.month - 1;
    monthlySales[monthIndex].totalSales = sale.totalSales;
  });

  return monthlySales.map((data, index) => ({
    month: MONTH_NAMES[index],
    totalSales: data.totalSales,
  }));
}

async function getTopUsersByOrders(limit = 5) {
  const usersAggregation = await Order.aggregate([
    {
      $group: {
        _id: "$OrderBy",
        orderCount: { $sum: 1 },
      },
    },
    { $sort: { orderCount: -1 } },
    { $limit: limit },
  ]);
  const userIds = usersAggregation.map((user) => user._id).filter(Boolean);
  const userDocs = await User.find({ _id: { $in: userIds } }).select("username Avatar");
  const userById = new Map(userDocs.map((user) => [String(user._id), user]));
  return usersAggregation.map((user) => {
    const userDetails = userById.get(String(user._id));
    return {
      userId: user._id,
      name: userDetails?.username || "Unknown",
      Avatar: userDetails?.Avatar || "Unknown",
      orderCount: user.orderCount,
    };
  });
}

module.exports = {
  calculateTotalPriceAllOrders,
  getMostPurchasedProducts,
  getTotalSalesByMonth,
  getTopUsersByOrders,
};
