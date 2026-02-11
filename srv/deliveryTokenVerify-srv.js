const cds = require('@sap/cds');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h'; // 24 hour session

module.exports = cds.service.impl(function () {
  async function verifyAndIssueSession(req) {
    // Accept token from body, query, or raw express request
    const token = (req.data && req.data.token)
      || (req.query && req.query.token)
      || (req._ && req._.req && req._.req.query && req._.req.query.token);

    if (!token) return req.error(400, 'Token is required.');

    try {
      // Look up token in database
      const tokenRecord = await cds.run(
        SELECT.one.from('AccessPage.Tokens').where({ token })
      );

      if (!tokenRecord) return req.error(404, 'Token not found.');
      if (tokenRecord.revoked) return req.error(403, 'Token has been revoked.');

      const now = new Date();
      if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) < now) {
        return req.error(403, 'Token has expired.');
      }

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
        const maxAgeMs = 24 * 60 * 60 * 1000;
        const isProd = process.env.NODE_ENV === 'production';
        if (typeof res.cookie === 'function') {
          res.cookie('delivery_session', sessionToken, {
            httpOnly: true,
            sameSite: 'Lax',
            secure: isProd,
            maxAge: maxAgeMs,
            path: '/'
          });
        } else {
          const parts = [
            `delivery_session=${sessionToken}`,
            'Path=/',
            'HttpOnly',
            'SameSite=Lax',
            `Max-Age=${Math.floor(maxAgeMs / 1000)}`
          ];
          if (isProd) parts.push('Secure');
          res.setHeader('Set-Cookie', parts.join('; '));
        }
      }

      return {
        success: true,
        orderID: tokenRecord.orderID_ID,
        sessionToken,
        expiresIn: 86400, // 24 hours in seconds
        message: 'Token verified. Use sessionToken for subsequent requests.'
      };
    } catch (err) {
      console.error('deliveryTokenVerify error:', err);
      return req.error(500, 'Token verification failed: ' + err.message);
    }
  }

  this.on('verifyToken', async (req) => {
    return verifyAndIssueSession(req);
  });

  this.on('verifyAndRedirect', async (req) => {
    const result = await verifyAndIssueSession(req);
    const redirect =
      (req.data && req.data.redirect) ||
      (req.query && req.query.redirect) ||
      (req._ && req._.req && req._.req.query && req._.req.query.redirect);

    if (redirect && req._ && req._.res && typeof req._.res.redirect === 'function') {
      req._.res.redirect(302, redirect);
      return result;
    }

    return result;
  });
});
