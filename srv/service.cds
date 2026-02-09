using { AccessPage as my } from '../db/schema.cds';

@path: '/service/accessPageInternal'
@requires: 'authenticated-user'
service accessPageInternalSrv {
  entity Buyers as projection on my.Buyers;
  entity Sellers as projection on my.Sellers;
  entity Products as projection on my.Products;
  entity Purchases as projection on my.Purchases;
  entity Mangel as projection on my.Mangel;
  entity Order as projection on my.Order;
  entity Delivery as projection on my.Delivery;
  entity Tokens as projection on my.Tokens;
}

@path: '/service/tokenGeneration'
@requires: 'authenticated-user'
service tokenGenerationSrv {
  function generateToken(purchaseId: Integer) returns String;
}

