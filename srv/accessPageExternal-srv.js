const cds = require('@sap/cds');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

module.exports = cds.service.impl(function() {
  const { Products, Purchases, Mangel } = this.entities;

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
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring('Bearer '.length);
    }
    const cookies = parseCookies(req.headers['cookie']);
    return cookies['delivery_session'];
  }

  function requireOrderID(req) {
    if (!req.user || !req.user.orderID) {
      req.reject(403, 'Access denied - no valid session.');
      return null;
    }
    return req.user.orderID;
  }

  // Validate JWT session token on all requests
  this.before('*', (req) => {
    const token = getSessionToken(req);
    if (!token) {
      return req.reject(401, 'Session token is required.');
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
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
    const orderID = requireOrderID(req);
    if (!orderID) return;
    req.query.where({ orderId_ID: orderID });
  });

  this.before('READ', Mangel, (req) => {
    const orderID = requireOrderID(req);
    if (!orderID) return;
    req.query.where([
      { ref: ['purchase', 'orderId_ID'] }, '=', { val: orderID }
    ]);
  });

  this.before('READ', Products, (req) => {
    const orderID = requireOrderID(req);
    if (!orderID) return;

    const subq = SELECT.from('AccessPage.Purchases')
      .columns('product_ID')
      .where({ orderId_ID: orderID });

    req.query.where({ ID: { in: subq } });
  });

  this.before('UPDATE', Mangel, async (req) => {
    const orderID = requireOrderID(req);
    if (!orderID) return;

    const keys = Object.keys(req.data || {});
    const allowed = new Set(['ID', 'ConfirmedQuantity']);
    const hasOnlyAllowed = keys.every((k) => allowed.has(k));
    if (!hasOnlyAllowed) {
      return req.reject(400, 'Only ConfirmedQuantity can be updated.');
    }

    const confirmed = req.data && req.data.ConfirmedQuantity;
    if (confirmed === undefined || confirmed === null) {
      return req.reject(400, 'ConfirmedQuantity is required.');
    }
    if (!Number.isInteger(confirmed) || confirmed < 0) {
      return req.reject(400, 'ConfirmedQuantity must be an integer >= 0.');
    }

    const mangelId = (req.data && req.data.ID)
      || (req.params && req.params[0] && req.params[0].ID);
    if (!mangelId) {
      return req.reject(400, 'Mangel ID is required.');
    }

    const record = await cds.run(
      SELECT.one.from(Mangel).where({
        ID: mangelId,
        purchase: { orderId_ID: orderID }
      })
    );
    if (!record) {
      return req.reject(403, 'Access denied for this record.');
    }
  });

  this.on('updateConfirmedQuantity', async (req) => {
    const orderID = requireOrderID(req);
    if (!orderID) return;

    const { mangelID, confirmedQuantity } = req.data || {};
    if (!mangelID) return req.reject(400, 'mangelID is required.');
    if (!Number.isInteger(confirmedQuantity) || confirmedQuantity < 0) {
      return req.reject(400, 'confirmedQuantity must be an integer >= 0.');
    }

    const record = await cds.run(
      SELECT.one.from(Mangel).where({
        ID: mangelID,
        purchase: { orderId_ID: orderID }
      })
    );
    if (!record) {
      return req.reject(403, 'Access denied for this record.');
    }

    await cds.run(
      UPDATE(Mangel, mangelID).set({ ConfirmedQuantity: confirmedQuantity })
    );

    return cds.run(SELECT.one.from(Mangel).where({ ID: mangelID }));
  });
});
