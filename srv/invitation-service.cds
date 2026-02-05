using { supplier.onboarding as db } from '../db/schema';

/**
 * Invitation Service - Internal users only
 * Handles creation and management of supplier invitations
 * Note: Auth disabled for local dev; will be enabled in Step 25 (BTP deployment)
 */
service InvitationService {
  
  // Invitations - internal users can create and view
  entity Invitations as projection on db.Invitations {
    *,
    supplier.companyName as supplierCompanyName,
    supplier.s4hanaStatus as supplierStatus
  };
  
  // Custom action to generate a new invitation (unbound - service level)
  action generateInvitation(
    supplierEmail: String(255),
    supplierName: String(255)
  ) returns {
    invitationID: String;
    invitationURL: String;
    token: String;
    expiresAt: DateTime;
  };
  
  // Read-only view of suppliers for monitoring
  @readonly
  entity Suppliers as projection on db.Suppliers;
}
