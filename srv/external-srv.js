const cds = require('@sap/cds');
const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const path = require('path');
const { randomUUID } = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';

module.exports = cds.service.impl(function() {
  const { Orders, Documents } = this.entities;

  // Helper functions
  function parseCookies(cookieHeader) {
    if (!cookieHeader) return {};
    return cookieHeader.split(';').reduce((acc, part) => {
      const idx = part.indexOf('=');
      if (idx === -1) return acc;
      const key = part.slice(0, idx).trim();
      const val = part.slice(idx + 1).trim();
      acc[key] = decodeURIComponent(val);
      return acc;
    }, {});
  }

  function getSessionToken(req) {
    // Try Authorization header first
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring('Bearer '.length);
    }
    // Fall back to cookie
    const cookies = parseCookies(req.headers['cookie']);
    return cookies['external_session'];
  }

  function requireOrderID(req) {
    if (!req.user || !req.user.orderID) {
      req.reject(403, 'Access denied - no valid session');
      return null;
    }
    return req.user.orderID;
  }

  // Validate JWT session token on all requests
  this.before('*', (req) => {
    const token = getSessionToken(req);
    if (!token) {
      return req.reject(401, 'Session token is required');
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      // Set user context from JWT
      req.user = {
        id: decoded.orderID,
        type: 'external-access',
        orderID: decoded.orderID,
        tokenID: decoded.tokenID
      };
      console.log(`[ExternalService] Authenticated external user for order ${decoded.orderID}`);
    } catch (err) {
      console.error('[ExternalService] JWT verification failed:', err.message);
      return req.reject(401, `Invalid or expired session: ${err.message}`);
    }
  });

  // Filter Orders by current user's orderID
  this.before('READ', Orders, (req) => {
    const orderID = requireOrderID(req);
    if (!orderID) return;
    req.query.where({ ID: orderID });
  });

  // Filter Documents by current user's order using association
  this.before('READ', Documents, (req) => {
    const orderID = requireOrderID(req);
    if (!orderID) return;
    
    // Use association filter
    req.query.where([
      { ref: ['order', 'ID'] }, '=', { val: orderID }
    ]);
  });

  // Confirm Delivery Action
  this.on('confirmDelivery', async (req) => {
    try {
      const orderID = requireOrderID(req);
      if (!orderID) return;

      const { deliveryDate, notes } = req.data;
      
      if (!deliveryDate) {
        return req.error(400, 'Delivery date is required');
      }

      // Check if order exists and belongs to user
      const order = await SELECT.one.from(Orders).where({ ID: orderID });
      if (!order) {
        return req.error(404, 'Order not found');
      }

      // Update order
      await UPDATE(Orders, orderID).set({
        status: 'CONFIRMED',
        deliveryConfirmedAt: new Date(deliveryDate),
        deliveryNotes: notes || null
      });

      console.log(`[ExternalService] Delivery confirmed for order ${orderID}`);

      // Send notification email to admin
      try {
        const { sendAdminNotification } = require('./utils/emailService');
        const order = await SELECT.one.from(Orders)
          .columns('orderNumber', 'deliveryNotes')
          .where({ ID: orderID });
        
        await sendAdminNotification({
          orderNumber: order.orderNumber,
          deliveryDate,
          deliveryNotes: notes || 'No notes provided',
          confirmedAt: new Date().toISOString()
        });
        console.log(`[ExternalService] Admin notification sent for order ${order.orderNumber}`);
      } catch (emailError) {
        // Log error but don't fail the confirmation
        console.error('[ExternalService] Failed to send admin notification:', emailError.message);
      }
      
      return {
        success: true,
        message: 'Delivery confirmed successfully'
      };
    } catch (err) {
      console.error('[ExternalService] Delivery confirmation error:', err);
      return req.error(500, `Failed to confirm delivery: ${err.message}`);
    }
  });

  // Upload Document Action
  this.on('uploadDocument', async (req) => {
    try {
      const orderID = requireOrderID(req);
      if (!orderID) return;

      const { filename, contentType, data } = req.data;
      
      if (!filename) {
        return req.error(400, 'Filename is required');
      }
      if (!contentType) {
        return req.error(400, 'Content type is required');
      }
      if (!data) {
        return req.error(400, 'File data is required');
      }

      // Validate file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
      if (!allowedTypes.includes(contentType.toLowerCase())) {
        return req.error(400, 'Invalid file type. Only PDF and images (JPG, PNG) are allowed');
      }

      // Check if order exists
      const order = await SELECT.one.from(Orders).where({ ID: orderID });
      if (!order) {
        return req.error(404, 'Order not found');
      }

      // Create uploads directory if it doesn't exist
      const uploadDir = path.join(process.cwd(), 'uploads');
      try {
        await fs.mkdir(uploadDir, { recursive: true });
      } catch (err) {
        // Directory might already exist
      }

      // Generate unique filename
      const ext = filename.split('.').pop();
      const uniqueFilename = `${randomUUID()}_${Date.now()}.${ext}`;
      const filepath = path.join(uploadDir, uniqueFilename);

      // Save file (data should be base64 encoded or buffer)
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'base64');
      await fs.writeFile(filepath, buffer);

      // Create document record
      const documentID = `DOC-${Date.now()}`;
      await INSERT.into(Documents).entries({
        ID: randomUUID(),
        documentID,
        filename,
        filetype: contentType,
        uploadedBy: 'supplier',
        createdAt: new Date(),
        order_ID: orderID,
        status_code: 'pending'
      });

      console.log(`[ExternalService] Document uploaded: ${documentID}`);

      return {
        success: true,
        documentID
      };
    } catch (err) {
      console.error('[ExternalService] Document upload error:', err);
      return req.error(500, `Failed to upload document: ${err.message}`);
    }
  });

  // Download Document Function
  this.on('downloadDocument', async (req) => {
    try {
      const orderID = requireOrderID(req);
      if (!orderID) return;

      const { documentID } = req.data;
      
      if (!documentID) {
        return req.error(400, 'Document ID is required');
      }

      // Get document and verify it belongs to user's order
      const document = await SELECT.one.from(Documents).where({ ID: documentID });
      
      if (!document) {
        return req.error(404, 'Document not found');
      }

      if (document.order_ID !== orderID) {
        return req.error(403, 'Access denied to this document');
      }

      // Read file content
      const uploadDir = path.join(process.cwd(), 'uploads');
      const uniqueFilename = `${document.ID}_*.${document.filename.split('.').pop()}`;
      
      // Find the actual file (it has UUID prefix)
      const files = await fs.readdir(uploadDir);
      const matchingFile = files.find(f => f.includes(document.ID));
      
      if (!matchingFile) {
        return req.error(404, 'Document file not found on server');
      }

      const filepath = path.join(uploadDir, matchingFile);
      const content = await fs.readFile(filepath);

      console.log(`[ExternalService] Document downloaded: ${document.documentID}`);

      return {
        filename: document.filename,
        contentType: document.filetype,
        content: content.toString('base64')
      };
    } catch (err) {
      console.error('[ExternalService] Document download error:', err);
      return req.error(500, `Failed to download document: ${err.message}`);
    }
  });
});
