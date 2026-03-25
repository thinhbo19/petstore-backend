require("dotenv").config();
const express = require("express");
const dbConnect = require("./config/dbconnect");
const initRouters = require("./router");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const ChatModel = require("./collection/Chat/model");
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
    credentials: true,
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
const extractObjectId = (value) => {
  if (!value) return "";
  const text = String(value).trim();
  const objectIdMatch = text.match(/ObjectId\(['"]([a-fA-F0-9]{24})['"]\)/);
  if (objectIdMatch) return objectIdMatch[1];
  const plainIdMatch = text.match(/\b([a-fA-F0-9]{24})\b/);
  if (plainIdMatch) return plainIdMatch[1];
  return "";
};
const normalizeId = (id) => {
  if (!id) return "";
  if (typeof id === "string") {
    return extractObjectId(id) || id.trim();
  }
  if (typeof id === "number" || typeof id === "boolean" || typeof id === "bigint")
    return String(id);
  if (typeof id === "object") {
    if (typeof id.toHexString === "function") return id.toHexString();
    if (typeof id.$oid === "string") return extractObjectId(id.$oid) || id.$oid;
    if (id._id && id._id !== id) return normalizeId(id._id);
    if (id.id && id.id !== id && typeof id.id !== "function") {
      const nested = normalizeId(id.id);
      if (nested && nested !== "[object Object]") return nested;
    }
    if (typeof id.toString === "function") {
      const asText = id.toString();
      if (asText && asText !== "[object Object]") return asText;
    }
    return "";
  }
  return String(id);
};
const hasMember = (members = [], userId) =>
  members.some((memberId) => normalizeId(memberId) === normalizeId(userId));

io.use((socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(" ")[1];

    if (!token) {
      return next(new Error("Unauthorized: missing token"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    return next();
  } catch (error) {
    return next(new Error("Unauthorized: invalid token"));
  }
});

// Xử lý sự kiện kết nối từ client
io.on("connection", (socket) => {
  const userId = normalizeId(socket.user?._id);
  console.log("new connect", socket.id, userId);

  const existedIndex = onlineUser.findIndex(
    (user) => normalizeId(user.userId) === userId,
  );
  if (existedIndex >= 0) {
    // Replace stale socket mapping if same user reconnects.
    onlineUser[existedIndex] = { userId, socketId: socket.id };
  } else if (userId) {
    onlineUser.push({
      userId,
      socketId: socket.id,
    });
  }
  io.emit("getOnlineUser", onlineUser);

  // Xử lý sự kiện gửi tin nhắn từ client
  socket.on("sendMess", async (message) => {
    try {
      const senderId = normalizeId(socket.user?._id);
      if (!senderId) return;
      const messageSenderId = normalizeId(message?.senderId);
      if (
        !message ||
        !message.chatId ||
        !messageSenderId ||
        messageSenderId !== senderId
      ) {
        return;
      }

      const chat = await ChatModel.findById(message.chatId);
      if (!chat) return;
      if (
        !hasMember(chat.members, messageSenderId)
      ) {
        return;
      }

      const receiverIds = chat.members
        .map((memberId) => normalizeId(memberId))
        .filter((memberId) => memberId && memberId !== senderId);

      const receivers = onlineUser.filter((user) =>
        receiverIds.includes(normalizeId(user.userId)),
      );
      for (const receiver of receivers) {
        io.to(receiver.socketId).emit("getMess", message);
        io.to(receiver.socketId).emit("getNotification", {
          senderId: message.senderId,
          isRead: false,
          chatId: message.chatId,
          date: new Date(),
        });
      }
    } catch (error) {
      console.error("Socket sendMess error:", error.message);
    }
  });

  // Xử lý ngắt kết nối
  socket.on("disconnect", () => {
    onlineUser = onlineUser.filter((user) => user.socketId !== socket.id);
    io.emit("getOnlineUser", onlineUser);
  });
});
