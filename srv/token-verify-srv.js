const cds = require('@sap/cds');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h'; // 24 hour session
const PIN_SALT = process.env.PIN_SALT || 'pin-salt-change-in-production';
const MAX_PIN_ATTEMPTS = 3;

module.exports = cds.service.impl(function () {
  
  function hashPin(pin) {
    return crypto
      .createHash('sha256')
      .update(`${PIN_SALT}:${pin}`)
      .digest('hex');
  }

  function validateTokenRecord(req, tokenRecord) {
    if (!tokenRecord) {
      console.warn(`[TokenVerification] Token not found`);
      return req.error(404, 'Token not found');
    }
    
    if (tokenRecord.revoked) {
      return req.error(403, 'Token has been revoked');
    }

    const now = new Date();
    if (tokenRecord.expiresAt && new Date(tokenRecord.expiresAt) < now) {
      return req.error(403, 'Token has expired');
    }

    const attempts = tokenRecord.pinAttempts || 0;
    if (attempts >= MAX_PIN_ATTEMPTS) {
      return req.error(403, 'Token has been locked due to too many failed PIN attempts');
    }

    return null;
  }

  async function createSessionAndSetCookie(req, tokenRecord) {
    const now = new Date();

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
      
      console.log('[TokenVerification] Setting cookie for session:', { 
        orderID: tokenRecord.order_ID, 
        isProd, 
        hasCookieMethod: typeof res.cookie === 'function' 
      });
      
      // Manually set cookie header to ensure it works
      const cookieParts = [
        `external_session=${sessionToken}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        `Max-Age=${Math.floor(maxAgeMs / 1000)}`
      ];
      if (isProd) cookieParts.push('Secure');
      
      res.setHeader('Set-Cookie', cookieParts.join('; '));
      console.log('[TokenVerification] Cookie header set:', cookieParts.join('; ').substring(0, 100) + '...');
    }

    console.log(`[TokenVerification] Token verified for order ${tokenRecord.order_ID}`);

    return {
      success: true,
      orderID: tokenRecord.order_ID,
      sessionToken,
      expiresIn: 86400,
      message: 'Authentication successful'
    };
  }

  this.on('verifyAndRedirect', async (req) => {
    const token = (req.data && req.data.token)
      || (req.query && req.query.token)
      || (req._ && req._.req && req._.req.query && req._.req.query.token);

    if (!token) {
      return req.error(400, 'Token is required');
    }

    const tokenRecord = await cds.run(
      SELECT.one.from('SupplierManagement.AccessTokens').where({ token })
    );

    const validationError = validateTokenRecord(req, tokenRecord);
    if (validationError) {
      return validationError;
    }

    // Get redirect parameter
    const finalRedirect =
      (req.data && req.data.redirect) ||
      (req.query && req.query.redirect) ||
      (req._ && req._.req && req._.req.query && req._.req.query.redirect);

    // Redirect to PIN page first
    const pinPagePath = process.env.PIN_PAGE_URL || '/pin/index.html';
    const redirectParam = encodeURIComponent(finalRedirect || '/external/index.html');
    const pinRedirect = `${pinPagePath}?token=${token}&redirect=${redirectParam}`;

    const res = req._ && req._.res;
    if (res && typeof res.redirect === 'function') {
      console.log('[TokenVerification] Redirecting to PIN page for order:', tokenRecord.order_ID);
      res.redirect(302, pinRedirect);
      return {
        success: true,
        message: 'Token verified. Please enter your PIN.'
      };
    }

    return {
      success: true,
      redirectUrl: pinRedirect,
      message: 'Token verified. Please enter your PIN.'
    };
  });

  this.on('verifyPin', async (req) => {
    const token = (req.data && req.data.token)
      || (req.query && req.query.token);
    const pin = (req.data && req.data.pin)
      || (req.query && req.query.pin);

    if (!token) {
      return req.error(400, 'Token is required');
    }
    if (!pin) {
      return req.error(400, 'PIN is required');
    }
    if (!/^\d{4}$/.test(pin)) {
      return req.error(400, 'PIN must be 4 digits');
    }

    const tokenRecord = await cds.run(
      SELECT.one
        .from('SupplierManagement.AccessTokens')
        .where({ token })
    );

    if (!tokenRecord) {
      return req.error(404, 'Token not found');
    }

    const validationError = validateTokenRecord(req, tokenRecord);
    if (validationError) {
      return validationError;
    }

    // Get order to find supplier
    const order = await cds.run(
      SELECT.one
        .from('SupplierManagement.Orders')
        .where({ ID: tokenRecord.order_ID })
    );

    if (!order) {
      console.error('[TokenVerification] Order not found for token:', tokenRecord.ID);
      return req.error(404, 'Order not found');
    }

    // Get supplier's PIN hash
    const supplier = await cds.run(
      SELECT.one
        .from('SupplierManagement.Suppliers')
        .where({ ID: order.supplier_ID })
    );

    if (!supplier || !supplier.pinHash) {
      console.error('[TokenVerification] No PIN set for supplier:', supplier?.ID);
      return req.error(500, 'PIN verification not configured. Please contact support.');
    }

    const inputPinHash = hashPin(pin);
    
    if (inputPinHash !== supplier.pinHash) {
      // Fire-and-forget: increment failed attempts in a detached transaction
      (async () => {
        await cds.tx(async tx => {
          const currentToken = await tx.run(
            SELECT.one
              .from('SupplierManagement.AccessTokens')
              .where({ ID: tokenRecord.ID })
          );
          const attempts = (currentToken.pinAttempts || 0) + 1;
          await tx.run(
            UPDATE('SupplierManagement.AccessTokens')
              .where({ ID: tokenRecord.ID })
              .set({
                pinAttempts: attempts,
                revoked: attempts >= MAX_PIN_ATTEMPTS
              })
          );
        });
      })();

      // Fetch current attempts to show remaining (may be off by 1 if user double-submits quickly)
      const currentToken = await cds.run(
        SELECT.one
          .from('SupplierManagement.AccessTokens')
          .where({ ID: tokenRecord.ID })
      );
      const attempts = (currentToken.pinAttempts || 0) + 1;
      const remaining = MAX_PIN_ATTEMPTS - attempts;
      if (remaining > 0) {
        return req.error(401, `Incorrect PIN. ${remaining} attempt(s) remaining.`);
      } else {
        return req.error(403, 'Too many failed attempts. Please contact the Support to request a new link.');
      }
    }

    // PIN correct - create session
    console.log('[TokenVerification] PIN verified successfully for order:', tokenRecord.order_ID);
    return await createSessionAndSetCookie(req, tokenRecord);
  });

  this.on('checkLinkAuthenticity', async (req) => {
    try {
      let urlOrToken = req.data?.urlOrToken || req.query?.urlOrToken;
      
      if (!urlOrToken) {
        return {
          isValid: false,
          message: 'Please provide a URL or token to verify',
          warningLevel: 'danger'
        };
      }

      // Extract token from URL if full URL provided
      let token = urlOrToken.trim();
      const tokenMatch = token.match(/[?&]token=([a-f0-9]{64})/i);
      if (tokenMatch) {
        token = tokenMatch[1];
      }

      // Validate token format (64 character hex string)
      if (!/^[a-f0-9]{64}$/i.test(token)) {
        return {
          isValid: false,
          message: '⚠️ Invalid token format. This does not appear to be a legitimate verification link from our system.',
          warningLevel: 'danger'
        };
      }

      // Look up token in database
      const tokenRecord = await cds.run(
        SELECT.one
          .from('SupplierManagement.AccessTokens')
          .columns('*', { ref: ['order', 'orderNumber'] }, { ref: ['order', 'supplier', 'name'] })
          .where({ token })
      );

      if (!tokenRecord) {
        return {
          isValid: false,
          message: '❌ This token was not found in our system. This may be a phishing attempt. Do not click the link!',
          warningLevel: 'danger'
        };
      }

      const now = new Date();
      const isExpired = tokenRecord.expiresAt && new Date(tokenRecord.expiresAt) < now;
      const isRevoked = tokenRecord.revoked;
      const isUsed = tokenRecord.linkInUse;

      // Determine warning level
      let warningLevel = 'safe';
      let message = '';

      if (isRevoked) {
        warningLevel = 'warning';
        message = '⚠️ This link has been revoked and is no longer valid. Contact support if you need a new link.';
      } else if (isExpired) {
        warningLevel = 'warning';
        message = '⏰ This link has expired. You will need to request a new verification link.';
      } else if (isUsed) {
        warningLevel = 'warning';
        message = '🔒 This link has already been used. For security, each link can only be used once. Request a new link if needed.';
      } else {
        const hoursUntilExpiry = Math.floor((new Date(tokenRecord.expiresAt) - now) / (1000 * 60 * 60));
        warningLevel = 'safe';
        message = `✅ This is a legitimate verification link from our system. It expires in ${hoursUntilExpiry} hours.`;
      }

      console.log(`[TokenVerification] Link authenticity check for token: ${token.substring(0, 10)}... - Valid: ${!isRevoked && !isExpired}`);

      return {
        isValid: true,
        isExpired,
        isRevoked,
        isUsed,
        createdAt: tokenRecord.createdAt,
        expiresAt: tokenRecord.expiresAt,
        orderNumber: tokenRecord.order?.orderNumber || 'N/A',
        supplierName: tokenRecord.order?.supplier?.name || 'N/A',
        message,
        warningLevel
      };
    } catch (err) {
      console.error('[TokenVerification] Link authenticity check error:', err);
      return {
        isValid: false,
        message: 'Unable to verify link authenticity. Please contact support.',
        warningLevel: 'danger'
      };
    }
  });
});
