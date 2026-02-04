using { supplier.onboarding as db } from '../db/schema';

/**
 * Invitation Service - Internal users only
 * Handles creation and management of supplier invitations
 */
service InvitationService @(requires: 'authenticated-user') {
  
  // Invitations - internal users can create and view
  entity Invitations as projection on db.Invitations {
    *,
    supplier.companyName as supplierCompanyName,
    supplier.s4hanaStatus as supplierStatus
  } actions {
    // Custom action to generate a new invitation
    action generateInvitation(
      supplierEmail: String(255),
      supplierName: String(255)
    ) returns {
      invitationID: String;
      invitationURL: String;
      token: String;
      expiresAt: DateTime;
    };
  };
  
  // Read-only view of suppliers for monitoring
  @readonly
  entity Suppliers as projection on db.Suppliers;
}
