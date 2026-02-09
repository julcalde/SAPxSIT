const cds = require('@sap/cds');
const crypto = require('crypto');
const { randomUUID } = require('crypto');

module.exports = cds.service.impl(function () {
  this.on('linkGeneration', async (req) => {
    const { orderID } = req.data;
    const userId = req.user && req.user.id;

    if (!userId || !orderID) return req.error(400, 'User ID and Order ID are required.');

    try {
      const order = await cds.run(SELECT.one.from('AccessPage.Order').where({ ID: orderID }));
      if (!order) return req.error(404, 'Order not found.');

      // generate a token
      const token = crypto.randomBytes(16).toString('hex');
      const expires = new Date(Date.now() + 42 * 60 * 60 * 1000); // 42 hours

      await cds.run(
        INSERT.into('AccessPage.Tokens').columns(
          'ID', 'token', 'orderID_ID', 'expires_at', 'revoked', 'linkInUse', 'lastUsed_at'
        ).values(
          randomUUID(), token, orderID, expires, false, false, null
        )
      );

      // Build the URL dynamically from request host (external verify endpoint)
      const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
      const host = req.headers['x-forwarded-host'] || req.headers['host'] || 'localhost:4004';
      const verifyUrl = `${protocol}://${host}/service/accessPageExternal/verifyToken?token=${token}`;

      return {
        token,
        verifyUrl
      };
    } catch (err) {
      console.error('linkGeneration error:', err);
      return req.error(500, 'Failed to generate token: ' + err.message);
    }
  });

});
