const cds = require('@sap/cds');
const crypto = require('crypto');
const { randomUUID } = require('crypto');
const nodemailer = require('nodemailer');
require('dotenv').config();

module.exports = cds.service.impl(function () {
  
  // Gmail transporter configuration
  const emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });

  // Send email function
  async function sendEmail(to, subject, html) {
    try {
      await emailTransporter.sendMail({
        from: process.env.GMAIL_USER,
        to: to,
        subject: subject,
        html: html
      });
      console.log(`Email sent successfully to ${to}`);
      return { success: true };
    } catch (error) {
      console.error('Email sending failed:', error);
      return { success: false, error: error.message };
    }
  }

  this.on('linkGeneration', async (req) => {
    const { orderID } = req.data;
    const userId = req.user && req.user.id;

    if (!userId || !orderID) return req.error(400, 'User ID and Order ID are required.');

    try {
      const order = await cds.run(SELECT.one.from('AccessPage.Order').where({ ID: orderID }));
      if (!order) return req.error(404, 'Order not found.');

      // generate a token
      const token = crypto.randomBytes(16).toString('hex');
      const expires = new Date(Date.now() + 42 * 60 * 60 * 1000); // 42 hours

      await cds.run(
        INSERT.into('AccessPage.Tokens').columns(
          'ID', 'token', 'orderID_ID', 'expires_at', 'revoked', 'linkInUse', 'lastUsed_at'
        ).values(
          randomUUID(), token, orderID, expires, false, false, null
        )
      );

      // Build the URL dynamically from request host (external verify endpoint)
      const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
      const host = req.headers['x-forwarded-host'] || req.headers['host'] || 'localhost:4004';
      const verifyUrl = `${protocol}://${host}/service/accessPageExternal/verifyToken?token=${token}`;

      // Send email notification
      const emailSubject = `Delivery Verification Link - Order ${orderID}`;
      const emailHtml = `
        <html>
          <body style="font-family: Arial, sans-serif;">
            <h2>Delivery Verification Required</h2>
            <p>Hello,</p>
            <p>A delivery verification link has been generated for Order ID: <strong>${orderID}</strong></p>
            
            <div style="margin: 20px 0; padding: 15px; background-color: #f5f5f5; border-radius: 5px;">
              <p><strong>Verification Link:</strong></p>
              <a href="${verifyUrl}" 
                 style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Verify Delivery
              </a>
            </div>
            
            <p><strong>Important:</strong> This link expires in 42 hours.</p>
            <p>If you cannot click the link, copy and paste this URL into your browser:</p>
            <p style="word-break: break-all; color: #666;">${verifyUrl}</p>
            
            <hr style="margin: 30px 0;">
            <p style="color: #888; font-size: 12px;">
              This is an automated message. Please do not reply to this email.
            </p>
          </body>
        </html>
      `;

      // Get recipient email (you may need to adjust this based on your data model)
      const recipientEmail = order.recipientEmail || 'default-recipient@example.com';
      
      // Send email
      const emailResult = await sendEmail(recipientEmail, emailSubject, emailHtml);
      
      if (!emailResult.success) {
        console.warn(`Failed to send email: ${emailResult.error}`);
        // Don't fail the whole operation if email fails, just log it
      }

      return {
        token,
        verifyUrl
      };
    } catch (err) {
      console.error('linkGeneration error:', err);
      return req.error(500, 'Failed to generate token: ' + err.message);
    }
  });

});
