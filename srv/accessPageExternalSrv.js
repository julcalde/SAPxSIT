module.exports = cds.service.impl(function() {
  const { PurchasesExternal } = this.entities;

  this.before('READ', PurchasesExternal, async (req) => {
    const token = req.headers['authorization-token'];
    // Verify token and restrict access to the associated order
    const purchase = await cds.transaction(req).run(
      SELECT.one.from(PurchasesExternal).where({ token })
    );
    if (!purchase) {
      req.reject(403, 'Invalid token or access denied');
    }
  });

  this.before('UPDATE', PurchasesExternal, async (req) => {
    const token = req.headers['authorization-token'];
    // Verify token before allowing update
    const purchase = await cds.transaction(req).run(
      SELECT.one.from(PurchasesExternal).where({ token })
    );
    if (!purchase) {
      req.reject(403, 'Invalid token or access denied');
    }
  });
});
