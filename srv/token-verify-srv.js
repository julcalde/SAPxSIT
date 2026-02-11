const cds = require('@sap/cds');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h'; // 24 hour session

module.exports = cds.service.impl(function () {
  async function verifyAndIssueSession(req) {
    // Accept token from body, query, or raw express request
    const token = (req.data && req.data.token)
      || (req.query && req.query.token)
      || (req._ && req._.req && req._.req.query && req._.req.query.token);

    if (!token) {
      return req.error(400, 'Token is required');
    }

    try {
      // Look up token in database
      const tokenRecord = await cds.run(
        SELECT.one.from('SupplierManagement.AccessTokens').where({ token })
      );

      if (!tokenRecord) {
        return req.error(404, 'Invalid token');
      }
      
      if (tokenRecord.revoked) {
        return req.error(403, 'Token has been revoked');
      }

      if (tokenRecord.linkInUse) {
        return req.error(403, 'Token has already been used. Please request a new verification link.');
      }

      const now = new Date();
      if (tokenRecord.expiresAt && new Date(tokenRecord.expiresAt) < now) {
        return req.error(403, 'Token has expired');
      }

      // Mark token as used
      await cds.run(
        UPDATE('SupplierManagement.AccessTokens', tokenRecord.ID).set({
          linkInUse: true,
          lastUsedAt: now
        })
      );

      // Create a JWT session token
      const sessionToken = jwt.sign(
        {
          orderID: tokenRecord.order_ID,
          tokenID: tokenRecord.ID,
          type: 'external-access'
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      // Set cookie if response object is available
      const res = req._ && req._.res;
      if (res) {
        const maxAgeMs = 24 * 60 * 60 * 1000;
        const isProd = process.env.NODE_ENV === 'production';
        
        if (typeof res.cookie === 'function') {
          res.cookie('external_session', sessionToken, {
            httpOnly: true,
            sameSite: 'Lax',
            secure: isProd,
            maxAge: maxAgeMs,
            path: '/'
          });
        } else {
          const parts = [
            `external_session=${sessionToken}`,
            'Path=/',
            'HttpOnly',
            'SameSite=Lax',
            `Max-Age=${Math.floor(maxAgeMs / 1000)}`
          ];
          if (isProd) parts.push('Secure');
          res.setHeader('Set-Cookie', parts.join('; '));
        }
      }

      console.log(`[TokenVerification] Token verified for order ${tokenRecord.order_ID}`);

      return {
        success: true,
        orderID: tokenRecord.order_ID,
        sessionToken,
        expiresIn: 86400, // 24 hours in seconds
        message: 'Token verified successfully. Session created.'
      };
    } catch (err) {
      console.error('[TokenVerification] Error:', err);
      return req.error(500, `Token verification failed: ${err.message}`);
    }
  }

  this.on('verifyToken', async (req) => {
    return verifyAndIssueSession(req);
  });

  this.on('verifyAndRedirect', async (req) => {
    const result = await verifyAndIssueSession(req);
    
    // If verification failed, don't redirect
    if (!result || !result.success) {
      return result;
    }
    
    // Get redirect parameter
    const redirect =
      (req.data && req.data.redirect) ||
      (req.query && req.query.redirect) ||
      (req._ && req._.req && req._.req.query && req._.req.query.redirect);

    // Perform redirect if available
    if (redirect && req._ && req._.res && typeof req._.res.redirect === 'function') {
      req._.res.redirect(302, redirect);
      return result;
    }

    return result;
  });
});
