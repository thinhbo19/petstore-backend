const slugify = require("slugify");

// Cấu hình slugify
const slugifyConfig = {
  lower: true, // Chuyển thành chữ thường
  strict: true, // Loại bỏ các ký tự đặc biệt
  locale: "vi", // Đảm bảo hỗ trợ các ký tự tiếng Việt
};

const generateSlug = (text) => slugify(text, slugifyConfig);

module.exports = {
  generateSlug,
};
