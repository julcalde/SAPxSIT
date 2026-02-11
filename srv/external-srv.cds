using { SupplierManagement } from '../db/schema.cds';

@path: '/service/external'
service ExternalAccessService {
  @readonly entity Orders as projection on SupplierManagement.Orders;
  @readonly entity Documents as projection on SupplierManagement.Documents;
  
  // Delivery confirmation action
  action confirmDelivery(deliveryDate: Date, notes: String) returns {
    success: Boolean;
    message: String;
  };
  
  // Document upload action
  action uploadDocument(filename: String, contentType: String, data: LargeBinary) returns {
    success: Boolean;
    documentID: String;
  };
  
  // Document download action
  function downloadDocument(documentID: UUID) returns {
    filename: String;
    contentType: String;
    content: LargeBinary;
  };
}
