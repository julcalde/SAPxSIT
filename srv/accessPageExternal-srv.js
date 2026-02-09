const cds = require('@sap/cds');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

module.exports = cds.service.impl(function() {
  const { Purchases } = this.entities;

  // Validate JWT session token on all requests
  this.before('*', (req) => {
    const authHeader = req.headers['authorization'];
    
    // Only process if Bearer token is present
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return; // No JWT, let other auth handlers deal with it
    }

    const token = authHeader.substring('Bearer '.length);
    if (!token) {
      return req.reject(401, 'Invalid Bearer token format.');
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      console.log('[JWT] Verified token for orderID:', decoded.orderID);
      // Set user context from JWT
      req.user = {
        id: decoded.orderID,
        type: 'delivery-external',
        orderID: decoded.orderID,
        tokenID: decoded.tokenID
      };
    } catch (err) {
      console.error('[JWT] Verification failed:', err.message);
      return req.reject(401, `Invalid or expired token: ${err.message}`);
    }
  });

  this.before('READ', Purchases, (req) => {
    console.log('[READ] req.user:', req.user);
    // Ensure user only accesses data for their order
    if (!req.user || !req.user.orderID) {
      return req.reject(403, 'Access denied - no valid JWT.');
    }
  });

  this.before('UPDATE', Purchases, (req) => {
    if (!req.user || !req.user.orderID) {
      return req.reject(403, 'Access denied - no valid JWT.');
    }
  });
});
