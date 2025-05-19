const nodemailer = require("nodemailer");
const asyncHandler = require("express-async-handler");

const sendMail = asyncHandler(async ({ email, html, type }) => {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_NAME,
      pass: process.env.EMAIL_APP_PASS,
    },
  });

  async function main() {
    try {
      let subject = "";
      if (type === "activation") {
        subject = "Activate your account";
      } else if (type === "reset") {
        subject = "Forgor password!";
      }
      // Send mail with defined transport object
      const info = await transporter.sendMail({
        from: '"PetStore " <no-reply@petstore.com>',
        to: email,
        subject: subject,
        html: html,
      });

      console.log("Message sent: %s", info.messageId);
    } catch (error) {
      console.error("Error sending email:", error);
      throw new Error("Failed to send email");
    }
  }

  await main();
});

module.exports = sendMail;
