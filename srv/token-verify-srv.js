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
        console.warn(`[TokenVerification] Invalid token attempt: ${token.substring(0, 10)}...`);
        return req.error(404, 'Invalid token');
      }
      
      if (tokenRecord.revoked) {
        return req.error(403, 'Token has been revoked');
      }

      if (tokenRecord.linkInUse) {
        console.warn(`[TokenVerification] Token reuse attempt for order ${tokenRecord.order_ID}, last used: ${tokenRecord.lastUsedAt}`);
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
      } else {
        console.warn('[TokenVerification] No response object available to set cookie!');
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
    const res = req._ && req._.res;
    if (redirect && res) {
      console.log('[TokenVerification] Redirecting to:', redirect);
      console.log('[TokenVerification] Session token for URL:', result.sessionToken ? 'EXISTS' : 'MISSING');
      
      // Pass the session token in URL since cookies aren't persisting through redirects
      const redirectUrl = `${redirect}?sessionToken=${encodeURIComponent(result.sessionToken)}`;
      console.log('[TokenVerification] Full redirect URL:', redirectUrl);
      
      res.status(200);
      res.setHeader('Content-Type', 'text/html');
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta http-equiv="refresh" content="1;url=${redirectUrl}">
          <title>Verifying Access...</title>
          <style>
            body { font-family: sans-serif; text-align: center; padding: 50px; }
            .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #3498db; 
                       border-radius: 50%; width: 40px; height: 40px; 
                       animation: spin 1s linear infinite; margin: 20px auto; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          </style>
        </head>
        <body>
          <div class="spinner"></div>
          <p>Verifying your access...</p>
          <p><small>Redirecting to your order details...</small></p>
          <script>
            setTimeout(function() {
              console.log('[Redirect] Navigating to:', '${redirectUrl}');
              window.location.href = '${redirectUrl}';
            }, 500);
          </script>
        </body>
        </html>
      `);
      return;
    }

    return result;
  });
});
