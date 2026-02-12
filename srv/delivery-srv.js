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

  async function generateLink(req, orderID) {
    const userId = req.user && req.user.id;

    if (!userId || !orderID)
      return req.error(400, "User ID and Order ID are required.");

    const order = await cds.run(
      SELECT.one.from("AccessPage.Order", (o) => {
        o`.*`, o.seller("*");
      }).where({ ID: orderID })
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
            "lastUsed_at",
            "pinAttempts"
          )
          .values(randomUUID(), token, orderID, expires, false, false, null, 0)
      );

    // Build the URL
    const verifyUrl = generatePublicUrl(req, token);

    return { token, verifyUrl, order };
  }

  this.on("linkGeneration", async (req) => {
    try {
      const { orderID } = req.data;
      const { token, verifyUrl } = await generateLink(req, orderID);
      return { token, verifyUrl };
    } catch (err) {
      console.error("linkGeneration error:", err);
      return req.error(500, "Failed to generate token: " + err.message);
    }
  });

  this.on("sendEmail", async (req) => {
    try {
      const { orderID } = req.data;
      // Await ensures verifyUrl is available before building the email body.
      const { token, verifyUrl, order } = await generateLink(req, orderID);

      // Send email using template
      const emailSubject = `Delivery Verification Link - Order ${orderID}`;
      const emailHtml = loadEmailTemplate(orderID, verifyUrl);
      const recipientEmail = order.seller?.email || "phofmann200@gmail.com";

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
      console.error("sendEmail error:", err);
      return req.error(500, "Failed to send email: " + err.message);
    }
  });
});
