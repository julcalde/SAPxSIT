namespace AccessPage;
using { cuid, Currency } from '@sap/cds/common';

@assert.unique: { buyersID: [buyersID] }
entity Buyers : cuid {
  buyersID: Integer @mandatory;
  name: String(100);
}

@assert.unique: { sellersID: [sellersID] }
entity Sellers : cuid {
  sellersID: Integer @mandatory;
  name: String(100);
  contactInfo: String(150);
  email: String(100);
  address: String(250);
  phone: String(20);
  taxInfo: String(100);
}

@assert.unique: { productId: [productId] }
entity Products : cuid {
  productId: Integer @mandatory;
  name: String(100);
  description: String(500);
  price: Decimal(10,2);
  Currency: Currency;
}

entity Purchases : cuid {
  orderId: Association to Order @mandatory;
  quantity: Integer;
  date: Date;
  product: Association to Products;
}

entity Mangel : cuid {
  istQuantity: Integer;
  differenceQuantity: Integer = (istQuantity - purchase.quantity);
  purchase: Association to Purchases;
  product: Association to Products;
  DeclinedQuantity: Integer @mandatory;
  DeclinedReason: String(500) @mandatory;
}

entity Order : cuid {
  buyer: Association to Buyers;
  created_on: DateTime;
  seller: Association to Sellers;
  sellerConfirmed: Boolean;
}

entity Delivery : cuid {
  orderId: Association to Order;
  deliveryCompleted: Boolean;
  delivered_on: DateTime;
}

@assert.unique: { token: [token] }
entity Tokens : cuid {
  token: String(100) @mandatory;
  orderID: Association to Order;
  expires_at: DateTime;
  revoked: Boolean;
  lastUsed_at: DateTime;
  linkInUse: Boolean;
}
