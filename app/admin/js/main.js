// app/admin/js/main.js
import { 
  fetchSuppliers, 
  fetchOrders, 
  fetchDocumentsForOrder,
  generateSecureLink, 
  sendVerificationEmail,
  updateDocumentStatus,
  createSupplier,
  createOrderAndToken,
  getDocumentDownloadUrl,
  uploadDocumentContent,
  createDocumentForOrder,
  deleteDocument,
  archiveSupplier,
  restoreSupplier,
  cancelOrder,
  restoreOrder
} from './api.js';

import { 
  showMessage, 
  renderSuppliers, 
  renderOrders, 
  renderDocuments,
  showLinkModal,
  hideLinkModal,
  showStatusModal,
  hideStatusModal,
  showDocumentsSection
} from './ui.js';

let currentOrders = [];
let currentSuppliers = [];
let showArchivedSuppliers = false;
let showCancelledOrders = false;

async function init() {
  try {
    // Fetch and render suppliers
    currentSuppliers = await fetchSuppliers();
    renderFilteredSuppliers();
    
    // Populate supplier dropdown
    populateSupplierDropdown(currentSuppliers);

    // Fetch and render orders
    currentOrders = await fetchOrders();
    renderFilteredOrders();

    // Wire up event handlers
    wireCreateSupplier();
    wireCreateOrder();
    wireDocumentUpload();
    wireFilters();

    showMessage('Data loaded successfully', 'success');
  } catch (error) {
    console.error('Initialization error:', error);
    showMessage(error.message, 'error');
  }
}

// Filter rendering
function renderFilteredSuppliers() {
  const filtered = showArchivedSuppliers 
    ? currentSuppliers 
    : currentSuppliers.filter(s => s.isActive !== false);
  renderSuppliers(filtered);
}

function renderFilteredOrders() {
  const filtered = showCancelledOrders
    ? currentOrders
    : currentOrders.filter(o => o.status !== 'CANCELLED');
  renderOrders(filtered);
}

// Wire filter checkboxes
function wireFilters() {
  const supplierCheckbox = document.getElementById('showArchivedSuppliers');
  const orderCheckbox = document.getElementById('showCancelledOrders');
  
  if (supplierCheckbox) {
    supplierCheckbox.addEventListener('change', (e) => {
      showArchivedSuppliers = e.target.checked;
      renderFilteredSuppliers();
    });
  }
  
  if (orderCheckbox) {
    orderCheckbox.addEventListener('change', (e) => {
      showCancelledOrders = e.target.checked;
      renderFilteredOrders();
    });
  }
}

// Populate supplier dropdown
function populateSupplierDropdown(suppliers) {
  const select = document.getElementById('supplierSelect');
  if (!select) return;
  
  // Only show active suppliers in dropdown
  const activeSuppliers = suppliers.filter(s => s.isActive !== false);
  
  select.innerHTML = '<option value="">-- Choose Supplier --</option>';
  activeSuppliers.forEach(s => {
    const option = document.createElement('option');
    option.value = s.ID;
    option.textContent = `${s.name} (${s.email})`;
    select.appendChild(option);
  });
}

// Create Supplier Handler
function wireCreateSupplier() {
  const btn = document.getElementById('createSupplierBtn');
  const msgEl = document.getElementById('supplierCreateMsg');
  
  if (!btn) return;
  
  btn.addEventListener('click', async () => {
    msgEl.textContent = '';
    
    const name = document.getElementById('newSupplierName')?.value.trim();
    const email = document.getElementById('newSupplierEmail')?.value.trim();
    
    if (!name || !email) {
      msgEl.textContent = 'Please enter name and email.';
      msgEl.className = 'text-sm text-red-600';
      return;
    }
    
    try {
      const supplier = await createSupplier(name, email);
      msgEl.textContent = `✅ Created: ${supplier.name} (${supplier.supplierID})`;
      msgEl.className = 'text-sm text-green-600';
      
      // Clear inputs
      document.getElementById('newSupplierName').value = '';
      document.getElementById('newSupplierEmail').value = '';
      
      // Refresh suppliers
      currentSuppliers = await fetchSuppliers();
      renderFilteredSuppliers();
      populateSupplierDropdown(currentSuppliers);
      
      showMessage('Supplier created successfully!', 'success');
    } catch (e) {
      msgEl.textContent = e?.message || String(e);
      msgEl.className = 'text-sm text-red-600';
    }
  });
}

// Archive Supplier Handler
window.handleArchiveSupplier = async function(supplierId) {
  if (!confirm('Archive this supplier? This will hide them from active lists. They can be restored later.')) {
    return;
  }
  
  try {
    showMessage('Archiving supplier...', 'info');
    await archiveSupplier(supplierId);
    
    // Refresh suppliers
    currentSuppliers = await fetchSuppliers();
    renderFilteredSuppliers();
    populateSupplierDropdown(currentSuppliers);
    
    showMessage('Supplier archived successfully!', 'success');
  } catch (error) {
    console.error('Archive supplier error:', error);
    showMessage(error.message, 'error');
  }
};

// Restore Supplier Handler
window.handleRestoreSupplier = async function(supplierId) {
  try {
    showMessage('Restoring supplier...', 'info');
    await restoreSupplier(supplierId);
    
    // Refresh suppliers
    currentSuppliers = await fetchSuppliers();
    renderFilteredSuppliers();
    populateSupplierDropdown(currentSuppliers);
    
    showMessage('Supplier restored successfully!', 'success');
  } catch (error) {
    console.error('Restore supplier error:', error);
    showMessage(error.message, 'error');
  }
};

// Create Order + Token Handler
function wireCreateOrder() {
  const btn = document.getElementById('createOrderBtn');
  const msgEl = document.getElementById('supplierCreateMsg');
  
  if (!btn) return;
  
  btn.addEventListener('click', async () => {
    const supplierId = document.getElementById('supplierSelect')?.value;
    
    if (!supplierId) {
      msgEl.textContent = 'Please select a supplier first.';
      msgEl.className = 'text-sm text-red-600';
      return;
    }
    
    try {
      msgEl.textContent = '';
      
      const result = await createOrderAndToken(supplierId);
      
      // Show token result
      const tokenResult = document.getElementById('tokenResult');
      const tokenLink = document.getElementById('tokenLink');
      if (tokenResult && tokenLink) {
        tokenLink.textContent = result.verifyUrl;
        tokenResult.classList.remove('hidden');
      }
      
      // Refresh orders
      currentOrders = await fetchOrders();
      renderFilteredOrders();
      
      showMessage('Order and verification link created!', 'success');
    } catch (e) {
      msgEl.textContent = e?.message || String(e);
      msgEl.className = 'text-sm text-red-600';
    }
  });
}

// Cancel Order Handler
window.handleCancelOrder = async function(orderId) {
  const reason = prompt('Enter cancellation reason (optional):');
  
  if (reason === null) {
    // User clicked cancel
    return;
  }
  
  try {
    showMessage('Cancelling order...', 'info');
    await cancelOrder(orderId, reason || 'Cancelled by admin');
    
    // Refresh orders
    currentOrders = await fetchOrders();
    renderFilteredOrders();
    
    showMessage('Order cancelled successfully!', 'success');
  } catch (error) {
    console.error('Cancel order error:', error);
    showMessage(error.message, 'error');
  }
};

// Restore Order Handler
window.handleRestoreOrder = async function(orderId) {
  if (!confirm('Restore this cancelled order?')) {
    return;
  }
  
  try {
    showMessage('Restoring order...', 'info');
    await restoreOrder(orderId);
    
    // Refresh orders
    currentOrders = await fetchOrders();
    renderFilteredOrders();
    
    showMessage('Order restored successfully!', 'success');
  } catch (error) {
    console.error('Restore order error:', error);
    showMessage(error.message, 'error');
  }
};

// Generate Link Handler
window.handleGenerateLink = async function(orderID) {
  try {
    showMessage('Generating secure link...', 'info');
    
    const result = await generateSecureLink(orderID);
    
    showLinkModal(result.verifyUrl, result.expiresAt);
    showMessage('Link generated successfully!', 'success');
  } catch (error) {
    console.error('Generate link error:', error);
    showMessage(error.message, 'error');
  }
};

// Send Email Handler
window.handleSendEmail = async function(orderID) {
  if (!confirm('Send verification email to supplier?')) {
    return;
  }

  try {
    showMessage('Sending email...', 'info');
    
    const result = await sendVerificationEmail(orderID);
    
    showMessage(result.message || 'Email sent successfully!', 'success');
    
    // Refresh orders to show updated status
    currentOrders = await fetchOrders();
    renderFilteredOrders();
  } catch (error) {
    console.error('Send email error:', error);
    showMessage(error.message, 'error');
  }
};

// View Documents Handler
window.handleViewDocuments = async function(orderID, orderNumber) {
  try {
    showMessage('Loading documents...', 'info');
    
    const documents = await fetchDocumentsForOrder(orderID);
    
    renderDocuments(documents);
    showDocumentsSection(orderNumber);
    
    showMessage(`Found ${documents.length} document(s)`, 'success');
  } catch (error) {
    console.error('View documents error:', error);
    showMessage(error.message, 'error');
  }
};

// Update Status Handler
window.handleUpdateStatus = function(documentID, currentStatus, currentFeedback) {
  showStatusModal(documentID, currentStatus, currentFeedback);
};

// Download Document Handler
window.handleDownloadDocument = function(docID, filename) {
  const downloadUrl = getDocumentDownloadUrl(docID);
  if (downloadUrl) {
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename || 'document.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
};

// Delete Document Handler
window.handleDeleteDocument = async function(docID) {
  if (!confirm('Are you sure you want to delete this document?')) {
    return;
  }
  
  try {
    showMessage('Deleting document...', 'info');
    await deleteDocument(docID);
    showMessage('Document deleted successfully!', 'success');
    
    // Refresh document list
    setTimeout(() => window.location.reload(), 1500);
  } catch (error) {
    console.error('Delete document error:', error);
    showMessage(error.message, 'error');
  }
};

// Wire Document Upload
function wireDocumentUpload() {
  // Create hidden file input for uploads
  const uploadInput = document.createElement('input');
  uploadInput.type = 'file';
  uploadInput.accept = 'application/pdf';
  uploadInput.className = 'hidden';
  uploadInput.id = 'adminOrderUploadInput';
  document.body.appendChild(uploadInput);
  
  uploadInput.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    
    if (file.type !== 'application/pdf') {
      showMessage('Please upload PDF files only.', 'error');
      uploadInput.value = '';
      return;
    }
    
    const orderId = uploadInput.dataset.targetOrderId;
    if (!orderId) {
      showMessage('No order selected.', 'error');
      uploadInput.value = '';
      return;
    }
    
    try {
      showMessage('Uploading document...', 'info');
      
      const docId = 'DOC-' + Date.now();
      const created = await createDocumentForOrder(orderId, docId, file.type);
      const targetID = created.ID || docId;
      
      await uploadDocumentContent(targetID, file);
      
      showMessage('Document uploaded successfully!', 'success');
      
      // Refresh view
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      console.error('Upload failed', err);
      showMessage('Upload failed: ' + (err.message || err), 'error');
    } finally {
      uploadInput.value = '';
      delete uploadInput.dataset.targetOrderId;
    }
  });
}

// Upload Document Button Handler
window.handleUploadDocument = function(orderID) {
  const uploadInput = document.getElementById('adminOrderUploadInput');
  if (!uploadInput) return;
  
  uploadInput.dataset.targetOrderId = orderID;
  uploadInput.click();
};

// Copy Link Button
const copyLinkBtn = document.getElementById('copyLinkBtn');
if (copyLinkBtn) {
  copyLinkBtn.addEventListener('click', () => {
    const linkEl = document.getElementById('generatedLink');
    if (linkEl) {
      navigator.clipboard.writeText(linkEl.textContent)
        .then(() => {
          showMessage('Link copied to clipboard!', 'success');
        })
        .catch(err => {
          showMessage('Failed to copy link', 'error');
        });
    }
  });
}

// Close Link Modal
const closeLinkModalBtn = document.getElementById('closeLinkModal');
if (closeLinkModalBtn) {
  closeLinkModalBtn.addEventListener('click', hideLinkModal);
}

// Close Status Modal
const closeStatusModalBtn = document.getElementById('closeStatusModal');
if (closeStatusModalBtn) {
  closeStatusModalBtn.addEventListener('click', hideStatusModal);
}

// Status Form Submit
const statusForm = document.getElementById('statusForm');
if (statusForm) {
  statusForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const documentID = document.getElementById('statusDocumentID').value;
    const statusCode = document.getElementById('statusCode').value;
    const feedback = document.getElementById('adminFeedback').value;

    try {
      showMessage('Updating document status...', 'info');
      
      await updateDocumentStatus(documentID, statusCode, feedback);
      
      hideStatusModal();
      showMessage('Document status updated successfully!', 'success');
      
      // Refresh documents if a section is visible
      const documentsSection = document.getElementById('documentsSection');
      if (documentsSection && !documentsSection.classList.contains('hidden')) {
        // Find the order ID from the currently displayed documents
        // For simplicity, we'll reload all orders and documents
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (error) {
      console.error('Update status error:', error);
      showMessage(error.message, 'error');
    }
  });
}

// Initialize app
init().catch(err => {
  console.error('Fatal initialization error:', err);
  showMessage('Failed to initialize application: ' + err.message, 'error');
});
