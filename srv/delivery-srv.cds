using { AccessPage as my } from '../db/schema.cds';

@path: '/service/delivery'
@requires: 'authenticated-user'
service deliverySrv {
  entity Delivery as projection on my.Delivery;
  
  type TokenResponse {
    token: String;
    verifyUrl: String;
  };
  action linkGeneration(orderID: UUID) returns TokenResponse;
  
}