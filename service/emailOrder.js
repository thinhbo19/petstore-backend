const generateOrderConfirmationEmail = (
  customerName,
  orderId,
  orderItems,
  totalAmount
) => {
  const orderRows = orderItems
    .map(
      (item) => `
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${
                item.name
              }</td>
              <td style="padding: 8px; text-align: center; border-bottom: 1px solid #ddd;">${
                item.count
              }</td>
              <td style="padding: 8px; text-align: right; border-bottom: 1px solid #ddd;">
                ${item.price.toLocaleString("vi-VN", {
                  style: "currency",
                  currency: "VND",
                })}
              </td>
            </tr>
          `
    )
    .join("");

  const orderUrl = `${process.env.URL_CLIENT}/order-detail/${orderId}`;

  return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Order Confirmation</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f7f7f7; color: #333;">
          <!-- Wrapper -->
          <div style="max-width: 600px; width: 100%; margin: 0 auto; background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <!-- Header -->
            <div style="background-color: #FF6F61; padding: 20px; text-align: center; color: white;">
              <h1 style="margin: 0; font-size: 24px;">🐾 Pet Shop</h1>
              <p style="margin: 0; font-size: 16px;">Cảm ơn bạn đã tin tưởng và mua sắm tại cửa hàng của chúng tôi!</p>
            </div>
            
            <!-- Main Content -->
            <div style="padding: 20px;">
              <h2 style="font-size: 22px; color: #FF6F61;">🎉 Đơn hàng đã được xác nhận!</h2>
              <p style="font-size: 16px; line-height: 1.6;">
                Chào <strong>${customerName}</strong>,
              </p>
              <p style="font-size: 16px; line-height: 1.6;">
                Đơn hàng <strong>#${orderId}</strong> của bạn đã được đặt thành công. Dưới đây là thông tin chi tiết:
              </p>
    
              <!-- Order Summary Table -->
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 16px;">
                <thead>
                  <tr>
                    <th style="text-align: left; border-bottom: 2px solid #ddd; padding: 8px;">Sản phẩm</th>
                    <th style="text-align: center; border-bottom: 2px solid #ddd; padding: 8px;">Số lượng</th>
                    <th style="text-align: right; border-bottom: 2px solid #ddd; padding: 8px;">Giá</th>
                  </tr>
                </thead>
                <tbody>
                  ${orderRows}
                </tbody>
              </table>
              <p style="font-size: 16px; text-align: right; font-weight: bold; margin: 20px 0;">
                Tổng cộng: ${totalAmount.toLocaleString("vi-VN", {
                  style: "currency",
                  currency: "VND",
                })}
              </p>
    
              <!-- Call to Action -->
              <div style="text-align: center; margin: 20px 0;">
                <a href="${orderUrl}" style="background-color: #FF6F61; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-size: 16px;">
                  Xem chi tiết đơn hàng
                </a>
              </div>
            </div>
    
            <!-- Footer -->
            <div style="background-color: #f7f7f7; padding: 10px; text-align: center; font-size: 12px; color: #999;">
              <p style="margin: 0;">Pet Shop Inc, Địa chỉ: 1234 Đường yêu thú cưng, Thành phố Động vật</p>
              <p style="margin: 0;">Cần hỗ trợ? <a href="#" style="color: #FF6F61; text-decoration: none;">Liên hệ với chúng tôi</a></p>
            </div>
          </div>
        </body>
        </html>
      `;
};

module.exports = {
  generateOrderConfirmationEmail,
};
