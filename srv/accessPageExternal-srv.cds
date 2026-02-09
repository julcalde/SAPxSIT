using { AccessPage as my } from '../db/schema.cds';

@path: '/service/accessPageExternal'
@requires: 'token-authenticated'
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
    ConfirmedQuantity
  };

  entity Tokens as projection on my.Tokens {
    token,
    orderID,
    expires_at,
    revoked,
    lastUsed_at,
    linkInUse
  };

  type VerifyResponse {
    success: Boolean;
    orderID: UUID;
    message: String;
  };

  action verifyToken(token: String) returns VerifyResponse;
}