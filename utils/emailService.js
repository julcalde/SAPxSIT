const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');

let transporter;

// Initialize email transporter with Ethereal test account if no credentials provided
async function initializeTransporter() {
  const hasCredentials = (process.env.EMAIL_USER || process.env.MAIL_USER) && 
                         (process.env.EMAIL_PASS || process.env.MAIL_PASS);

  if (!hasCredentials) {
    console.log('[EmailService] No email credentials found. Creating Ethereal test account...');
    const testAccount = await nodemailer.createTestAccount();
    
    console.log('[EmailService] ✅ Ethereal test account created:');
    console.log('   Email:', testAccount.user);
    console.log('   Password:', testAccount.pass);
    console.log('   Preview URL: Check console after sending emails');
    
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
  } else {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || process.env.MAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT || process.env.MAIL_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.EMAIL_USER || process.env.MAIL_USER,
        pass: process.env.EMAIL_PASS || process.env.MAIL_PASS
      }
    });
  }

  return transporter;
}

// Get or initialize transporter
async function getTransporter() {
  if (!transporter) {
    await initializeTransporter();
  }
  return transporter;
}

/**
 * Send verification email with secure access link
 */
async function sendVerificationEmail({ supplierEmail, supplierName, orderNumber, verifyUrl, expiresAt }) {
  const transporter = await getTransporter();
  
  // Load email template
  const templatePath = path.join(__dirname, '..', 'srv', 'templates', 'verification-email.html');
  let htmlContent = await fs.readFile(templatePath, 'utf8');

  // Load CSS styles
  const stylesPath = path.join(__dirname, '..', 'srv', 'templates', 'email-styles.css');
  const cssStyles = await fs.readFile(stylesPath, 'utf8');

  // Helper function to escape HTML
  const escapeHtml = (text) => {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  // Replace placeholders
  htmlContent = htmlContent
    .replace('{{styles}}', cssStyles)
    .replace(/{{supplierName}}/g, escapeHtml(supplierName))
    .replace(/{{orderNumber}}/g, escapeHtml(orderNumber))
    .replace(/{{verifyUrl}}/g, verifyUrl)
    .replace(/{{expiresAt}}/g, escapeHtml(new Date(expiresAt).toLocaleString()));

  const mailOptions = {
    from: process.env.EMAIL_USER || process.env.MAIL_USER || 'noreply@supplier-system.com',
    to: supplierEmail,
    subject: `Order Verification Required - ${orderNumber}`,
    html: htmlContent
  };

  const info = await transporter.sendMail(mailOptions);
  
  // Log preview URL for Ethereal
  if (info.messageId && transporter.transporter?.host === 'smtp.ethereal.email') {
    console.log('[EmailService] 📧 Preview URL:', nodemailer.getTestMessageUrl(info));
  }
  
  return info;
}

/**
 * Send delivery confirmation notification to admin
 */
async function sendAdminNotification({ orderNumber, deliveryDate, deliveryNotes, confirmedAt }) {
  const transporter = await getTransporter();
  const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER || process.env.MAIL_USER;
  
  if (!adminEmail) {
    console.warn('[EmailService] Admin email not configured - skipping notification');
    return null;
  }

  const mailOptions = {
    from: process.env.EMAIL_USER || process.env.MAIL_USER,
    to: adminEmail,
    subject: `✅ Delivery Confirmed - Order ${orderNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #0070f3; color: white; padding: 20px; border-radius: 5px 5px 0 0;">
          <h2 style="margin: 0;">Delivery Confirmation Received</h2>
        </div>
        
        <div style="padding: 20px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 5px 5px;">
          <p>A supplier has confirmed delivery for the following order:</p>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 8px 0;"><strong>Order Number:</strong> ${orderNumber}</p>
            <p style="margin: 8px 0;"><strong>Delivery Date:</strong> ${deliveryDate}</p>
            <p style="margin: 8px 0;"><strong>Confirmed At:</strong> ${new Date(confirmedAt).toLocaleString()}</p>
          </div>
          
          <div style="background-color: white; padding: 15px; border-left: 4px solid #0070f3; margin: 20px 0;">
            <p style="margin: 0 0 5px 0;"><strong>Delivery Notes:</strong></p>
            <p style="margin: 0; color: #333;">${deliveryNotes}</p>
          </div>
          
          <p style="color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
            This is an automated notification from the Supplier Management System.<br>
            Please review the delivery confirmation in the admin panel.
          </p>
        </div>
      </div>
    `
  };

  const info = await transporter.sendMail(mailOptions);
  
  // Log preview URL for Ethereal
  if (info.messageId && transporter.transporter?.host === 'smtp.ethereal.email') {
    console.log('[EmailService] 📧 Admin notification preview:', nodemailer.getTestMessageUrl(info));
  }
  
  return info;
}

module.exports = {
  sendVerificationEmail,
  sendAdminNotification,
  initializeTransporter
};
