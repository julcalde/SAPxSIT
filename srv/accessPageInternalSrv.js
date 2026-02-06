module.exports = cds.service.impl(function() {
  const { Purchases, Order } = this.entities;

  this.before('CREATE', Purchases, (req) => {
    if (req.data.quantity <= 0) {
      req.error(400, 'Quantity must be greater than zero');
    }
  });

  this.after('CREATE', Purchases, async (req) => {
    const { user } = req;
    if (!user || !user.id) {
      req.error(400, 'User information is missing');
      return;
    }

    const currentDateTime = new Date();

    // Create a new order associated with the purchase
    await INSERT.into(Order).columns(
      'created_by_ID', 
      'created_on', 
      'sellerConfirmed'
    ).values(
      user.id, 
      currentDateTime, 
      false
    );

    // Logic to handle after order creation, e.g., logging or notifications
  });
});