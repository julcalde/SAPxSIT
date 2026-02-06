const crypto = require('crypto');

module.exports = cds.service.impl(function() {
  this.on('generateToken', async (req) => {
    const purchaseId = req.data.purchaseId;
    const token = crypto.createHash('sha256').update(purchaseId.toString()).digest('hex');
    return token;
  });
});
