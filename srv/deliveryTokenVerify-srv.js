const cds = require('@sap/cds');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '1m';
const SESSION_COOKIE_MAX_AGE_MS = 60 * 1000;
const PIN_SALT = process.env.PIN_SALT || 'pin-salt-change-me';
const MAX_PIN_ATTEMPTS = 3;

module.exports = cds.service.impl(function () {
  function getTokenFromReq(req) {
    return (req.data && req.data.token)
      || (req.query && req.query.token)
      || (req._ && req._.req && req._.req.query && req._.req.query.token);
  }

  function hashPin(pin) {
    return crypto
      .createHash('sha256')
      .update(`${PIN_SALT}:${pin}`)
      .digest('hex');
  }

  function validateTokenRecord(req, tokenRecord) {
    if (!tokenRecord) return req.error(404, 'Token not found.');
    if (tokenRecord.revoked) return req.error(403, 'Token has been revoked.');

    const now = new Date();
    if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) < now) {
      return req.error(403, 'Token has expired.');
    }

    const attempts = tokenRecord.pinAttempts || 0;
    if (attempts >= MAX_PIN_ATTEMPTS) {
      return req.error(403, 'Token has been revoked.');
    }

    return null;
  }

  async function verifyAndIssueSession(req, tokenRecord) {
    const validationError = validateTokenRecord(req, tokenRecord);
    if (validationError) return validationError;

    const now = new Date();

    // Mark token as used
    await cds.run(
      UPDATE('AccessPage.Tokens', tokenRecord.ID).set({
        linkInUse: true,
        lastUsed_at: now
      })
    );

    // Create a JWT session token
    const sessionToken = jwt.sign(
      {
        orderID: tokenRecord.orderID_ID,
        tokenID: tokenRecord.ID,
        type: 'delivery-access'
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    const res = req._ && req._.res;
    if (res) {
      const isProd = process.env.NODE_ENV === 'production';
      if (typeof res.cookie === 'function') {
        res.cookie('delivery_session', sessionToken, {
          httpOnly: true,
          sameSite: 'Lax',
          secure: isProd,
          maxAge: SESSION_COOKIE_MAX_AGE_MS,
          path: '/'
        });
      } else {
        const parts = [
          `delivery_session=${sessionToken}`,
          'Path=/',
          'HttpOnly',
          'SameSite=Lax',
          `Max-Age=${Math.floor(SESSION_COOKIE_MAX_AGE_MS / 1000)}`
        ];
        if (isProd) parts.push('Secure');
        res.setHeader('Set-Cookie', parts.join('; '));
      }
    }

    return {
      success: true,
      orderID: tokenRecord.orderID_ID,
      sessionToken,
      expiresIn: Math.floor(SESSION_COOKIE_MAX_AGE_MS / 1000),
      message: 'Token verified. Use sessionToken for subsequent requests.'
    };
  }

  this.on('verifyToken', async (req) => {
    try {
      const token = getTokenFromReq(req);
      if (!token) return req.error(400, 'Token is required.');
      const tokenRecord = await cds.run(
        SELECT.one.from('AccessPage.Tokens').where({ token })
      );
      return verifyAndIssueSession(req, tokenRecord);
    } catch (err) {
      console.error('deliveryTokenVerify error:', err);
      return req.error(500, 'Token verification failed: ' + err.message);
    }
  });

  this.on('verifyAndRedirect', async (req) => {
    const token = getTokenFromReq(req);
    if (!token) return req.error(400, 'Token is required.');
    const tokenRecord = await cds.run(
      SELECT.one.from('AccessPage.Tokens').where({ token })
    );
    const validationError = validateTokenRecord(req, tokenRecord);
    if (validationError) return validationError;

    const finalRedirect =
      (req.data && req.data.redirect) ||
      (req.query && req.query.redirect) ||
      (req._ && req._.req && req._.req.query && req._.req.query.redirect);

    const pinPagePath = process.env.PIN_PAGE_URL || '/pin/index.html';
    const redirectParam = encodeURIComponent(finalRedirect || '/external/index.html');
    const pinRedirect = `${pinPagePath}?token=${token}&redirect=${redirectParam}`;

    if (req._ && req._.res && typeof req._.res.redirect === 'function') {
      req._.res.redirect(302, pinRedirect);
      return {
        success: true,
        orderID: tokenRecord.orderID_ID,
        sessionToken: null,
        expiresIn: 0,
        message: 'Token verified. Enter PIN.'
      };
    }

    return {
      success: true,
      orderID: tokenRecord.orderID_ID,
      sessionToken: null,
      expiresIn: 0,
      message: 'Token verified. Enter PIN.'
    };
  });

  this.on('verifyPin', async (req) => {
    try {
      const token = getTokenFromReq(req);
      const pin = (req.data && req.data.pin) || (req.query && req.query.pin);

      if (!token) return req.error(400, 'Token is required.');
      if (!pin) return req.error(400, 'PIN is required.');
      if (!/^\d{4}$/.test(pin)) return req.error(400, 'PIN must be 4 digits.');

      const tokenRecord = await cds.run(
        SELECT.one.from('AccessPage.Tokens').where({ token })
      );

      if (!tokenRecord) return req.error(404, 'Token not found.');
      if (tokenRecord.revoked) return req.error(403, 'Token has been revoked.');

      const now = new Date();
      if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) < now) {
        return req.error(403, 'Token has expired.');
      }

      const attempts = tokenRecord.pinAttempts || 0;
      if (attempts >= MAX_PIN_ATTEMPTS) {
        await cds.run(
          UPDATE('AccessPage.Tokens', tokenRecord.ID).set({ revoked: true })
        );
        return req.error(403, 'Token revoked after too many failed attempts.');
      }

      const order = await cds.run(
        SELECT.one.from('AccessPage.Order', (o) => {
          o.ID;
          o.seller((s) => {
            s.ID;
            s.pinHash;
          });
        }).where({ ID: tokenRecord.orderID_ID })
      );

      const sellerPinHash = order && order.seller && order.seller.pinHash;
      if (!sellerPinHash) {
        return req.error(500, 'Seller PIN not configured.');
      }

      const expected = sellerPinHash;
      const actual = hashPin(pin);
      if (actual !== expected) {
        const nextAttempts = attempts + 1;
        const shouldRevoke = nextAttempts >= MAX_PIN_ATTEMPTS;
        await cds.run(
          UPDATE('AccessPage.Tokens', tokenRecord.ID).set({
            pinAttempts: nextAttempts,
            revoked: shouldRevoke ? true : tokenRecord.revoked
          })
        );
        const remaining = Math.max(0, MAX_PIN_ATTEMPTS - nextAttempts);
        return req.error(403, `Invalid PIN. Attempts remaining: ${remaining}.`);
      }

      await cds.run(
        UPDATE('AccessPage.Tokens', tokenRecord.ID).set({ pinAttempts: 0 })
      );

      return verifyAndIssueSession(req, tokenRecord);
    } catch (err) {
      console.error('verifyPin error:', err);
      return req.error(500, 'PIN verification failed: ' + err.message);
    }
  });
});
