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
        .columns('*', { ref: ['order', 'supplier', 'pinHash'] })
        .where({ token })
    );

    if (!tokenRecord) {
      return req.error(404, 'Token not found');
    }

    const validationError = validateTokenRecord(req, tokenRecord);
    if (validationError) {
      return validationError;
    }

    // Get supplier's PIN hash via order
    const supplier = await cds.run(
      SELECT.one
        .from('SupplierManagement.Suppliers')
        .where({ ID: tokenRecord.order.supplier_ID })
    );

    if (!supplier || !supplier.pinHash) {
      console.error('[TokenVerification] No PIN set for supplier:', supplier?.ID);
      return req.error(500, 'PIN verification not configured. Please contact support.');
    }

    const inputPinHash = hashPin(pin);
    
    if (inputPinHash !== supplier.pinHash) {
      // Increment failed attempts
      const newAttempts = (tokenRecord.pinAttempts || 0) + 1;
      await cds.run(
        UPDATE('SupplierManagement.AccessTokens', tokenRecord.ID).set({
          pinAttempts: newAttempts,
          revoked: newAttempts >= MAX_PIN_ATTEMPTS
        })
      );

      const remaining = MAX_PIN_ATTEMPTS - newAttempts;
      if (remaining > 0) {
        console.warn(`[TokenVerification] Failed PIN attempt ${newAttempts}/${MAX_PIN_ATTEMPTS} for order:`, tokenRecord.order_ID);
        return req.error(401, `Incorrect PIN. ${remaining} attempt(s) remaining.`);
      } else {
        console.error('[TokenVerification] Token revoked after max PIN attempts for order:', tokenRecord.order_ID);
        return req.error(403, 'Token has been locked due to too many failed attempts.');
      }
    }

    // PIN correct - create session
    console.log('[TokenVerification] PIN verified successfully for order:', tokenRecord.order_ID);
    return await createSessionAndSetCookie(req, tokenRecord);
  });
});
