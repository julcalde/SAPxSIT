const cds = require('@sap/cds');
const crypto = require('crypto');
const { randomUUID } = require('crypto');
const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');
const { generatePublicUrl } = require('./utils/url-generator');

module.exports = cds.service.impl(function () {
  const { Suppliers, Orders, Documents, AccessTokens, DocumentStatus } = this.entities;

  // Mock authentication for development
  if (process.env.NODE_ENV !== 'production') {
    this.before('*', (req) => {
      if (!req.user || !req.user.id) {
        req.user = { id: 'admin-001', name: 'Test Admin' };
      }
    });
  }

  // -------------------------
  // Helper: Generate Token
  // -------------------------
  async function generateToken(orderID, createdBy = 'admin') {
    // Check if order exists
    const order = await SELECT.one.from(Orders).where({ ID: orderID });
    if (!order) {
      throw new Error('Order not found');
    }

    // Generate token
    const token = crypto.randomBytes(32).toString('hex');
    // 42 hours, 13 minutes, 37 seconds = (42 * 60 * 60 + 13 * 60 + 37) * 1000 ms
    const expires = new Date(Date.now() + (42 * 60 * 60 + 13 * 60 + 37) * 1000);

    // Store token in database
    await INSERT.into(AccessTokens).entries({
      ID: randomUUID(),
      token,
      order_ID: orderID,
      expiresAt: expires,
      revoked: false,
      linkInUse: false,
      createdBy
    });

    console.log(`[InternalService] Generated token for order ${orderID}`);

    return {
      token,
      expiresAt: expires
    };
  }

  // -------------------------
  // Token Generation
  // -------------------------
  this.on('generateSecureLink', async (req) => {
    try {
      const { orderID } = req.data;
      
      if (!orderID) {
        return req.error(400, 'Order ID is required');
      }

      const result = await generateToken(orderID, req.user?.id || 'admin');
      const verifyUrl = generatePublicUrl(req, result.token);

      return {
        token: result.token,
        verifyUrl,
        expiresAt: result.expiresAt.toISOString()
      };
    } catch (err) {
      console.error('[InternalService] Token generation error:', err);
      if (err.message === 'Order not found') {
        return req.error(404, err.message);
      }
      return req.error(500, `Failed to generate token: ${err.message}`);
    }
  });

  // -------------------------
  // Supplier Creation
  // -------------------------
  this.on('createSupplier', async (req) => {
    try {
      const { name, email } = req.data;
      
      if (!name || !email) {
        return req.error(400, 'Name and email are required');
      }

      // Generate supplier ID
      const supplierID = `SUP-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const newSupplier = {
        ID: randomUUID(),
        supplierID,
        name,
        email
      };

      await INSERT.into(Suppliers).entries(newSupplier);

      console.log(`[InternalService] Created supplier ${supplierID} - ${name}`);

      return newSupplier;
    } catch (err) {
      console.error('[InternalService] Supplier creation error:', err);
      return req.error(500, `Failed to create supplier: ${err.message}`);
    }
  });

  // -------------------------
  // Combined Order + Token Creation
  // -------------------------
  this.on('createOrderAndToken', async (req) => {
    try {
      const { supplierId } = req.data;
      
      if (!supplierId) {
        return req.error(400, 'Supplier ID is required');
      }

      // Check supplier exists
      const supplier = await SELECT.one.from(Suppliers).where({ ID: supplierId });
      if (!supplier) {
        return req.error(404, 'Supplier not found');
      }

      // Create order
      const orderId = randomUUID();
      await INSERT.into(Orders).entries({
        ID: orderId,
        orderNumber: `ORD-${Date.now()}`,
        supplier_ID: supplierId,
        createdAt: new Date(),
        status: 'PENDING'
      });

      // Generate token
      const tokenResult = await generateToken(orderId, req.user?.id || 'admin');
      const verifyUrl = generatePublicUrl(req, tokenResult.token);

      console.log(`[InternalService] Created order ${orderId} with token for supplier ${supplier.name}`);

      return {
        orderId,
        token: tokenResult.token,
        verifyUrl
      };
    } catch (err) {
      console.error('[InternalService] Order+Token creation error:', err);
      return req.error(500, `Failed to create order and token: ${err.message}`);
    }
  });

  // -------------------------
  // Token Revocation
  // -------------------------
  this.on('revokeToken', async (req) => {
    try {
      const { tokenID } = req.data;
      
      if (!tokenID) {
        return req.error(400, 'Token ID is required');
      }

      // Check if token exists
      const token = await SELECT.one.from(AccessTokens).where({ ID: tokenID });
      if (!token) {
        return req.error(404, 'Token not found');
      }

      // Revoke token
      await UPDATE(AccessTokens, tokenID).set({ 
        revoked: true,
        revokedAt: new Date(),
        revokedBy: req.user?.id || 'admin'
      });

      console.log(`[InternalService] Revoked token ${tokenID}`);

      return {
        success: true,
        message: 'Token revoked successfully'
      };
    } catch (err) {
      console.error('[InternalService] Token revocation error:', err);
      return req.error(500, `Failed to revoke token: ${err.message}`);
    }
  });

  // -------------------------
  // Email Integration
  // -------------------------
  this.on('sendVerificationEmail', async (req) => {
    try {
      const { orderID } = req.data;
      
      if (!orderID) {
        return req.error(400, 'Order ID is required');
      }

      // Get order with supplier information
      const order = await SELECT.one.from(Orders, (o) => {
        o`.*`,
        o.supplier('*')
      }).where({ ID: orderID });

      if (!order) {
        return req.error(404, 'Order not found');
      }

      if (!order.supplier || !order.supplier.email) {
        return req.error(400, 'Order has no supplier email');
      }

      // Generate secure link using helper function
      const tokenResult = await generateToken(orderID, req.user?.id || 'admin');
      const verifyUrl = generatePublicUrl(req, tokenResult.token);

      // Configure email transporter
      const transporter = nodemailer.createTransport({
        host: process.env.MAIL_HOST,
        port: Number(process.env.MAIL_PORT || 587),
        secure: false,
        auth: {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PASS
        }
      });

      // Load email template
      const templatePath = path.join(process.cwd(), 'srv', 'templates', 'verification-email.html');
      let html = await fs.readFile(templatePath, 'utf8');

      // Try to embed CSS inline
      try {
        const cssPath = path.join(process.cwd(), 'srv', 'templates', 'email-styles.css');
        const css = await fs.readFile(cssPath, 'utf8');
        html = html.replace(
          /<link rel="stylesheet" href="email-styles\.css"\s*\/?>/i,
          `<style>${css}</style>`
        );
      } catch {
        html = html.replace(/<link rel="stylesheet" href="email-styles\.css"\s*\/?>/i, '');
      }

      // Replace placeholders
      html = html
        .replaceAll('{{orderID}}', escapeHtml(order.orderNumber || orderID))
        .replaceAll('{{verifyUrl}}', escapeAttr(verifyUrl))
        .replaceAll('{{supplierName}}', escapeHtml(order.supplier.name || 'Supplier'))
        .replaceAll('{{expiresAt}}', escapeHtml(tokenResult.expiresAt.toLocaleString()));

      // Send email
      await transporter.sendMail({
        from: `"Delivery Verification" <${process.env.MAIL_USER}>`,
        to: order.supplier.email,
        subject: `Delivery Verification Required - Order ${order.orderNumber || orderID}`,
        html
      });

      // Update order status
      await UPDATE(Orders, orderID).set({ status: 'LINK_SENT' });

      console.log(`[InternalService] Email sent to ${order.supplier.email}`);

      return {
        success: true,
        message: `Email sent successfully to ${order.supplier.email}`,
        verifyUrl
      };
    } catch (err) {
      console.error('[InternalService] Email sending error:', err);
      return req.error(500, `Failed to send email: ${err.message}`);
    }
  });

  // -------------------------
  // Document Status Update
  // -------------------------
  this.on('updateDocumentStatus', async (req) => {
    try {
      const { documentID, statusCode, feedback } = req.data;
      
      if (!documentID) {
        return req.error(400, 'Document ID is required');
      }
      if (!statusCode) {
        return req.error(400, 'Status code is required');
      }

      // Validate status code exists in DocumentStatus code list
      const validStatus = await SELECT.one.from(DocumentStatus).where({ code: statusCode });
      if (!validStatus) {
        return req.error(400, `Invalid status code. Must be one of: pending, approved, rejected`);
      }

      // Check if document exists
      const doc = await SELECT.one.from(Documents).where({ ID: documentID });
      if (!doc) {
        return req.error(404, 'Document not found');
      }

      // Update document
      await UPDATE(Documents, documentID).set({
        status_code: statusCode,
        adminFeedback: feedback || null
      });

      console.log(`[InternalService] Updated document ${documentID} status to ${statusCode}`);

      return `Document status updated successfully`;
    } catch (err) {
      console.error('[InternalService] Document update error:', err);
      return req.error(500, `Failed to update document: ${err.message}`);
    }
  });
});

// Helper functions
function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttr(s) {
  return escapeHtml(s).replaceAll('`', '&#096;');
}
