require("dotenv").config();
const express = require("express");
const dbConnect = require("./config/dbconnect");
const initRouters = require("./router");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();

// Cấu hình CORS cho Express
app.use(
  cors({
    origin: ["http://localhost:3000", process.env.URL_CLIENT], // Đảm bảo URL_CLIENT được định nghĩa trong .env
    methods: ["POST", "PUT", "GET", "DELETE", "PATCH"],
  })
);

// Cấu hình Cookie parser cho Express
app.use(cookieParser());

// Cấu hình Express để xử lý JSON và URL-encoded requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Kết nối cơ sở dữ liệu
dbConnect();

// Khởi tạo các router cho Express
initRouters(app);

// Tạo HTTP server từ Express
const server = app.listen(process.env.PORT || 8888, () => {
  console.log("Server running on port " + (process.env.PORT || 8888));
});

// Tạo một instance của socket.io và truyền HTTP server vào
const io = new Server(server, {
  cors: {
    origin: process.env.URL_CLIENT, // Đảm bảo URL_CLIENT được định nghĩa trong .env
    methods: ["GET", "POST"],
  },
});

// Danh sách người dùng trực tuyến
let onlineUser = [];

// Xử lý sự kiện kết nối từ client
io.on("connection", (socket) => {
  console.log("new connect", socket.id);

  // Thêm người dùng mới vào danh sách onlineUser khi có sự kiện "addNewUser"
  socket.on("addNewUser", (userId) => {
    if (!onlineUser.some((user) => user.userId === userId)) {
      onlineUser.push({
        userId,
        socketId: socket.id,
      });
    }

    // Phát lại danh sách người dùng trực tuyến cho tất cả client
    io.emit("getOnlineUser", onlineUser);
  });

  // Xử lý sự kiện gửi tin nhắn từ client
  socket.on("sendMess", (message) => {
    const user = onlineUser.find((user) => user.userId === message.recipientId);
    if (user) {
      // Gửi tin nhắn cho người nhận
      io.to(user.socketId).emit("getMess", message);
      // Gửi thông báo cho người nhận
      io.to(user.socketId).emit("getNotification", {
        senderId: message.senderId,
        isRead: false,
        chatId: message.chatId,
        date: new Date(),
      });
    }
  });

  // Xử lý ngắt kết nối
  socket.on("disconnect", () => {
    onlineUser = onlineUser.filter((user) => user.socketId !== socket.id);
    io.emit("getOnlineUser", onlineUser);
  });
});
