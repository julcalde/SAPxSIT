using { AccessPage as my } from '../db/schema.cds';

@path: '/service/accessPageExternal'
service accessPageExternalSrv {
  entity Products as projection on my.Products {
    ID,
    productId,
    name,
    price,
    Currency
  };
  
  entity Purchases as projection on my.Purchases {
    ID,
    orderId,
    quantity,
    date,
    product
  };

  entity Mangel as projection on my.Mangel {
    istQuantity,
    differenceQuantity,
    purchase,
    product,
    DeclinedQuantity,
    DeclinedReason
  };

  entity Tokens as projection on my.Tokens {
    token,
    orderID,
    expires_at,
    revoked,
    lastUsed_at,
    linkInUse
  };

  entity Delivery as projection on my.Delivery {
    ID,
    orderId,
    deliveryCompleted,
    delivered_on
  };

  entity Order as projection on my.Order {
    ID,
    buyer,
    created_on,
    seller,
    sellerConfirmed
  }
  action getCurrentOrder() returns Order;
  action setSellerConfirmed(confirmed: Boolean) returns Order;
}
