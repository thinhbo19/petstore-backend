require("dotenv").config();
const express = require("express");
const dbConnect = require("./config/dbconnect");
const initRouters = require("./router");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const ChatModel = require("./collection/Chat/model");
const { normalizeId, hasMember } = require("./utils/idUtils");
const {
  swaggerUi,
  swaggerSpec,
  mergedTags,
  getSwaggerSpecByTag,
} = require("./swagger");
const { renderSwaggerHome } = require("./swagger/homepage");

const app = express();

// Nhiều môi trường: thêm origin vào mảng hoặc đọc từ biến môi trường (ví dụ split CORS_ORIGINS bằng dấu phẩy).
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      process.env.URL_CLIENT,
    ].filter(Boolean),
    methods: ["POST", "PUT", "GET", "DELETE", "PATCH"],
    credentials: true,
  })
);

app.use(cookieParser());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/api-docs", (req, res) => {
  const html = renderSwaggerHome(mergedTags);
  res.send(html);
});

app.use("/api-docs/:tag", swaggerUi.serve);

app.get("/api-docs/:tag", (req, res, next) => {
  const tagName = req.params.tag;
  
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

dbConnect();

initRouters(app);

const server = app.listen(process.env.PORT || 8888, () => {
  console.log("Server running on port " + (process.env.PORT || 8888));
});

const io = new Server(server, {
  cors: {
    origin: process.env.URL_CLIENT, // Đảm bảo URL_CLIENT được định nghĩa trong .env
    methods: ["GET", "POST"],
  },
});

let onlineUser = [];

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

io.on("connection", (socket) => {
  const userId = normalizeId(socket.user?._id);

  const existedIndex = onlineUser.findIndex(
    (user) => normalizeId(user.userId) === userId,
  );
  if (existedIndex >= 0) {
    onlineUser[existedIndex] = { userId, socketId: socket.id };
  } else if (userId) {
    onlineUser.push({
      userId,
      socketId: socket.id,
    });
  }
  io.emit("getOnlineUser", onlineUser);

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

  socket.on("disconnect", () => {
    onlineUser = onlineUser.filter((user) => user.socketId !== socket.id);
    io.emit("getOnlineUser", onlineUser);
  });
});
