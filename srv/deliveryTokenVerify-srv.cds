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
  function verifyAndRedirect(token: String, redirect: String) returns VerifyTokenResponse;
}
