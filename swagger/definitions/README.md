# Swagger Definitions Structure

Các file Swagger definitions được tổ chức theo nhóm chức năng để dễ quản lý và bảo trì.

## Cấu trúc thư mục

### Users (`users/`)
- `tag.yaml` - Định nghĩa tag Users
- `auth.yaml` - Authentication (register, login, OTP, password reset)
- `profile.yaml` - Quản lý profile (get, update, admin actions)
- `cart.yaml` - Quản lý giỏ hàng
- `favorites.yaml` - Quản lý yêu thích
- `address.yaml` - Quản lý địa chỉ
- `vouchers.yaml` - Quản lý voucher của user

### Booking (`booking/`)
- `tag.yaml` - Định nghĩa tag Booking
- `basic.yaml` - CRUD cơ bản (create, get, update, delete)
- `admin.yaml` - API dành cho admin (thống kê, báo cáo)
- `payment.yaml` - Thanh toán (VNPay, callback)

### Orders (`orders/`)
- `tag.yaml` - Định nghĩa tag Orders
- `basic.yaml` - CRUD cơ bản
- `admin.yaml` - API dành cho admin (thống kê, báo cáo)
- `payment.yaml` - Thanh toán (VNPay, MoMo)

### Các module khác
Các module nhỏ hơn (Categories, News, Pets, Products, etc.) được giữ trong file YAML đơn lẻ vì số lượng endpoints ít hơn.

## Quy tắc đặt tên

- `tag.yaml` - File định nghĩa tag (bắt buộc cho mỗi module)
- `basic.yaml` - Các endpoint CRUD cơ bản
- `admin.yaml` - Các endpoint dành cho admin
- `payment.yaml` - Các endpoint liên quan đến thanh toán
- Tên file khác theo chức năng (auth, profile, cart, etc.)

## Cách thêm/swửa API docs

1. Tìm file YAML tương ứng với endpoint bạn muốn sửa
2. Chỉnh sửa file YAML đó
3. Server sẽ tự động load lại khi restart

## Lưu ý

- Mỗi file YAML có thể chứa nhiều paths
- Tags được định nghĩa trong file `tag.yaml` của mỗi module
- Swagger.js sẽ tự động merge tất cả file YAML từ tất cả thư mục con

