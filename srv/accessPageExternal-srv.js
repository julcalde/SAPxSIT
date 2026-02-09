const cds = require('@sap/cds');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

module.exports = cds.service.impl(function() {
  const { Purchases } = this.entities;

  // Validate JWT session token on all requests
  this.before('*', async (req) => {
    // Skip for non-authenticated requests (if any)
    if (req.user && req.user.id) {
      return; // Already authenticated
    }

    // Look for JWT in Authorization header (Bearer token)
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return req.error(401, 'Authorization header missing.');
    }

    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return req.error(401, 'Invalid authorization format.');
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      // Attach order context to request for downstream handlers
      req.user = {
        id: decoded.orderID,
        type: 'delivery-external',
        orderID: decoded.orderID,
        tokenID: decoded.tokenID
      };
    } catch (err) {
      return req.error(401, `Invalid or expired token: ${err.message}`);
    }
  });

  this.before('READ', Purchases, async (req) => {
    // Ensure user only accesses data for their order
    if (!req.user || !req.user.orderID) {
      return req.error(403, 'Access denied.');
    }
    // Optionally filter by orderID automatically
    // req.query.where([{ ref: ['orderId_ID'] }, '=', { val: req.user.orderID }]);
  });

  this.before('UPDATE', Purchases, async (req) => {
    if (!req.user || !req.user.orderID) {
      return req.error(403, 'Access denied.');
    }
  });
});
