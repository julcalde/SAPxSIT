using { SupplierManagement } from '../db/schema.cds';

@path: '/service/internal'
@requires: 'authenticated-user'
service InternalService {
  entity Suppliers as projection on SupplierManagement.Suppliers;
  entity Orders as projection on SupplierManagement.Orders;
  entity Documents as projection on SupplierManagement.Documents;
  entity AccessTokens as projection on SupplierManagement.AccessTokens;
  entity DocumentStatus as projection on SupplierManagement.DocumentStatus;
  
  // Token generation and email actions
  type TokenResponse {
    token: String;
    verifyUrl: String;
    expiresAt: DateTime;
  };
  
  action generateSecureLink(orderID: UUID) returns TokenResponse;
  action sendVerificationEmail(orderID: UUID) returns {
    success: Boolean;
    message: String;
    verifyUrl: String;
  };
  action revokeToken(tokenID: UUID) returns {
    success: Boolean;
    message: String;
  };
  
  // Document management
  action updateDocumentStatus(documentID: UUID, statusCode: String, feedback: String) returns String;
}
