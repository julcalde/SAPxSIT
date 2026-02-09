using { AccessPage as my } from '../db/schema.cds';

@path: '/service/deliveryTokenVerify'
service deliveryTokenVerifySrv {
  type VerifyTokenResponse {
    success: Boolean;
    orderID: UUID;
    sessionToken: String;
    expiresIn: Integer;
    message: String;
  };

  action verifyToken(token: String) returns VerifyTokenResponse;
}
