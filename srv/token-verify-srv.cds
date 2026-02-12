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
  
  type LinkAuthenticityResponse {
    isValid: Boolean;
    isExpired: Boolean;
    isRevoked: Boolean;
    isUsed: Boolean;
    createdAt: DateTime;
    expiresAt: DateTime;
    orderNumber: String;
    supplierName: String;
    message: String;
    warningLevel: String; // 'safe', 'warning', 'danger'
  };
  
  action verifyToken(token: String) returns VerifyTokenResponse;
  function verifyAndRedirect(token: String, redirect: String) returns VerifyTokenResponse;
  action verifyPin(token: String, pin: String) returns VerifyTokenResponse;
  action checkLinkAuthenticity(urlOrToken: String) returns LinkAuthenticityResponse;
}
