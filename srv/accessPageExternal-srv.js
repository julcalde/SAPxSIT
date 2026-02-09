const cds = require('@sap/cds');

module.exports = cds.service.impl(function() {
  const { Purchases } = this.entities;

  this.before('READ', Purchases, async (req) => {
    const token = req.headers['authorization-token'];
    // Verify token and restrict access to the associated order
    const purchase = await cds.transaction(req).run(
      SELECT.one.from(Purchases).where({ token })
    );
    if (!purchase) {
      req.reject(403, 'Invalid token or access denied');
    }
  });

  this.before('UPDATE', Purchases, async (req) => {
    const token = req.headers['authorization-token'];
    // Verify token before allowing update
    const purchase = await cds.transaction(req).run(
      SELECT.one.from(Purchases).where({ token })
    );
    if (!purchase) {
      req.reject(403, 'Invalid token or access denied');
    }
  });

  this.on('verifyToken', async (req) => {
    // accept token from body, query, params or raw express req
    const token = (req.data && req.data.token)
      || (req.query && req.query.token)
      || (req.params && req.params.token)
      || (req._ && req._.req && req._.req.query && req._.req.query.token);

    if (!token) return req.error(400, 'Token is required.');

    try {
      const tokenRecord = await cds.run(
        SELECT.one.from('AccessPage.Tokens').where({ token })
      );

      if (!tokenRecord) return req.error(404, 'Token not found.');
      if (tokenRecord.revoked) return req.error(403, 'Token has been revoked.');

      const now = new Date();
      if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) < now) {
        return req.error(403, 'Token has expired.');
      }

      await cds.run(
        UPDATE('AccessPage.Tokens', tokenRecord.ID).set({
          linkInUse: true,
          lastUsed_at: now
        })
      );

      return {
        success: true,
        orderID: tokenRecord.orderID_ID,
        message: 'Token verified and marked as used'
      };
    } catch (err) {
      console.error('verifyToken error (external):', err);
      return req.error(500, 'Token verification failed: ' + err.message);
    }
  });
});
