require("dotenv").config();
const express = require("express");
const dbConnect = require("./config/dbconnect");
const initRouters = require("./router");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const { Server } = require("socket.io");
const {
  swaggerUi,
  swaggerSpec,
  mergedTags,
  getSwaggerSpecByTag,
} = require("./swagger");
const { renderSwaggerHome } = require("./swagger/homepage");

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

// Swagger UI - Trang chủ hiển thị danh sách tags
app.get("/api-docs", (req, res) => {
  const html = renderSwaggerHome(mergedTags);
  res.send(html);
});

// Serve Swagger UI assets (phải đặt trước route GET)
app.use("/api-docs/:tag", swaggerUi.serve);

// Swagger UI cho từng tag cụ thể
app.get("/api-docs/:tag", (req, res, next) => {
  const tagName = req.params.tag;
  
  // Kiểm tra xem tag có tồn tại không
  const tagExists = mergedTags.some((t) => t.name === tagName);
  if (!tagExists) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Tag Not Found</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 50px;
            background: #f5f5f5;
          }
          .error {
            background: white;
            padding: 30px;
            border-radius: 10px;
            display: inline-block;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          a {
            color: #667eea;
            text-decoration: none;
            margin-top: 20px;
            display: inline-block;
          }
        </style>
      </head>
      <body>
        <div class="error">
          <h1>Tag "${tagName}" không tồn tại</h1>
          <a href="/api-docs">← Quay lại danh sách tags</a>
        </div>
      </body>
      </html>
    `);
  }

  const tagSpec = getSwaggerSpecByTag(tagName);
  return swaggerUi.setup(tagSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: `${tagName} API Documentation`,
  })(req, res, next);
});

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
