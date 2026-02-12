namespace SupplierManagement;

using { managed, cuid } from '@sap/cds/common';
using { sap.common.CodeList } from '@sap/cds/common';

/**
 * Document Status Code List
 */
entity DocumentStatus : CodeList {
  key code: String(20);
  criticality: Integer;
}

/**
 * Suppliers entity - stores supplier master data
 */
entity Suppliers : cuid {
  supplierID: String(50) @assert.unique @mandatory;
  name: String(100);
  email: String(100);
  pinHash: String(200); // Hashed PIN for 2FA
  isActive: Boolean default true; // Soft delete flag
  archivedAt: DateTime;
  archivedBy: String(100);
  
  // One-to-many relationship with orders
  orders: Association to many Orders on orders.supplier = $self;
}

/**
 * Orders entity - purchase orders
 */
entity Orders : cuid {
  orderNumber: String(50);
  createdAt: DateTime;
  status: String(20) default 'PENDING'; // PENDING, LINK_SENT, VIEWED, CONFIRMED, CANCELLED
  cancelledAt: DateTime;
  cancelledBy: String(100);
  cancellationReason: String(500);
  deliveryConfirmedAt: DateTime;
  deliveryNotes: String(500);
  
  // Many-to-one relationship with supplier
  supplier: Association to Suppliers;
  
  // One-to-many relationships
  documents: Association to many Documents on documents.order = $self;
  tokens: Association to many AccessTokens on tokens.order = $self;
}

/**
 * Documents entity - attached documents for orders
 */
entity Documents : cuid {
  documentID: String(50) @assert.unique @mandatory;
  filename: String(100);
  filetype: String(50);
  uploadedBy: String(20); // 'admin' or 'supplier'
  createdAt: DateTime;
  adminFeedback: String(500);
  
  // Many-to-one relationships
  status: Association to DocumentStatus;
  order: Association to Orders;
}

/**
 * AccessTokens entity - secure access tokens for external users
 */
entity AccessTokens : cuid {
  token: String(100) @assert.unique @mandatory;
  expiresAt: DateTime;
  revoked: Boolean default false;
  linkInUse: Boolean default false;
  lastUsedAt: DateTime;
  createdBy: String(100);
  pinAttempts: Integer default 0; // Track failed PIN attempts
  
  // Many-to-one relationship with order
  order: Association to Orders;
}
