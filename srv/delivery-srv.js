const cds = require("@sap/cds");
const crypto = require("crypto");
const { randomUUID } = require("crypto");
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const { generatePublicUrl } = require('./deliveryPublicURL-srv');

module.exports = cds.service.impl(function () {
  // Gmail transporter configuration
  const emailTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  // Load email template
  function loadEmailTemplate(orderID, verifyUrl) {
    const templatePath = path.join(
      __dirname,
      "templates",
      "standardEmail.html"
    );
    let html = fs.readFileSync(templatePath, "utf8");

    // Replace placeholders
    html = html.replace(/\{\{orderID\}\}/g, orderID);
    html = html.replace(/\{\{verifyUrl\}\}/g, verifyUrl);

    return html;
  }

  // Send email function
  async function sendEmail(to, subject, html) {
    try {
      await emailTransporter.sendMail({
        from: process.env.GMAIL_USER,
        to: to,
        subject: subject,
        html: html,
      });
      console.log(`Email sent successfully to ${to}`);
      return { success: true };
    } catch (error) {
      console.error("Email sending failed:", error);
      return { success: false, error: error.message };
    }
  }

  this.on("linkGeneration", async (req) => {
    const { orderID } = req.data;
    const userId = req.user && req.user.id;

    if (!userId || !orderID)
      return req.error(400, "User ID and Order ID are required.");

    try {
      const order = await cds.run(
        SELECT.one.from("AccessPage.Order").where({ ID: orderID })
      );
      if (!order) return req.error(404, "Order not found.");

      // generate a token
      const token = crypto.randomBytes(16).toString("hex");
      const expires = new Date(Date.now() + 42 * 60 * 60 * 1000); // 42 hours

      await cds.run(
        INSERT.into("AccessPage.Tokens")
          .columns(
            "ID",
            "token",
            "orderID_ID",
            "expires_at",
            "revoked",
            "linkInUse",
            "lastUsed_at"
          )
          .values(randomUUID(), token, orderID, expires, false, false, null)
      );

      // Build the URL
      const protocol =
        req.headers["x-forwarded-proto"] || (req.secure ? "https" : "http");
      const host =
        req.headers["x-forwarded-host"] ||
        req.headers["host"] ||
        "localhost:4004";
      const verifyUrl = `${protocol}://${host}/service/accessPageExternal/verifyToken?token=${token}`;

      // Send email using template
      const emailSubject = `Delivery Verification Link - Order ${orderID}`;
      const emailHtml = loadEmailTemplate(orderID, verifyUrl);
      const recipientEmail =
        order.recipientEmail || "phofmann200@gmail.com";

      const emailResult = await sendEmail(
        recipientEmail,
        emailSubject,
        emailHtml
      );

      if (!emailResult.success) {
        console.warn(`Failed to send email: ${emailResult.error}`);
      }

      return { token, verifyUrl };
    } catch (err) {
      console.error("linkGeneration error:", err);
      return req.error(500, "Failed to generate token: " + err.message);
    }
  });
});
