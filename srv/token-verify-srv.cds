@path: '/service/verify'
service TokenVerificationService {
  type VerifyTokenResponse {
    success: Boolean;
    orderID: UUID;
    sessionToken: String;
    expiresIn: Integer;
    message: String;
    redirectUrl: String;
  };
  
  action verifyToken(token: String) returns VerifyTokenResponse;
  function verifyAndRedirect(token: String, redirect: String) returns VerifyTokenResponse;
  action verifyPin(token: String, pin: String) returns VerifyTokenResponse;
}
