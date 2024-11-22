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
          <style>
            body {
              margin: 0;
              padding: 0;
              font-family: 'Arial', sans-serif;
              background-color: #f7f7f7;
              color: #333;
            }
            .email-wrapper {
              max-width: 600px;
              width: 100%;
              margin: 0 auto;
              background-color: white;
              border-radius: 10px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              font-size: 16px;
            }
            .email-header {
              background-color: #FF6F61;
              padding: 20px;
              text-align: center;
              color: white;
            }
            .email-header h1 {
              margin: 0;
              font-size: 24px;
            }
            .email-body {
              padding: 20px;
            }
            .email-body h2 {
              font-size: 22px;
              color: #FF6F61;
              text-align: center;
            }
            .email-table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
              font-size: 16px;
              word-break: break-word;
            }
            .email-table th, .email-table td {
              padding: 8px;
              border-bottom: 1px solid #ddd;
            }
            .email-table th {
              text-align: left;
              border-bottom: 2px solid #ddd;
            }
            .email-footer {
              background-color: #f7f7f7;
              padding: 10px;
              text-align: center;
              font-size: 12px;
              color: #999;
            }
            .email-button {
              display: inline-block;
              background-color: #FF6F61;
              color: white;
              padding: 12px 24px;
              text-decoration: none;
              border-radius: 8px;
              font-size: 16px;
              max-width: 80%;
              word-break: break-word;
            }
          </style>
        </head>
        <body>
          <div class="email-wrapper">
            <!-- Header -->
            <div class="email-header">
              <h1>🐾 Pet Shop</h1>
              <p>Cảm ơn bạn đã tin tưởng và mua sắm tại cửa hàng của chúng tôi!</p>
            </div>
            
            <!-- Main Content -->
            <div class="email-body">
              <h2>🎉 Đơn hàng đã được xác nhận!</h2>
              <p>Chào <strong>${customerName}</strong>,</p>
              <p>Đơn hàng <strong>#${orderId}</strong> của bạn đã được đặt thành công. Dưới đây là thông tin chi tiết:</p>
    
              <!-- Order Summary Table -->
              <table class="email-table">
                <thead>
                  <tr>
                    <th>Sản phẩm</th>
                    <th style="text-align: center;">Số lượng</th>
                    <th style="text-align: right;">Giá</th>
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
                <a href="${orderUrl}" class="email-button">Xem chi tiết đơn hàng</a>
              </div>
            </div>
    
            <!-- Footer -->
            <div class="email-footer">
              <p>Pet Shop Inc, Địa chỉ: 1234 Đường yêu thú cưng, Thành phố Động vật</p>
              <p>Cần hỗ trợ? <a href="#" style="color: #FF6F61; text-decoration: none;">Liên hệ với chúng tôi</a></p>
            </div>
          </div>
        </body>
        </html>
      `;
};

module.exports = {
  generateOrderConfirmationEmail,
};
