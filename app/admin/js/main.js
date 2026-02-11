// app/admin/js/main.js
import { 
  fetchSuppliers, 
  fetchOrders, 
  fetchDocumentsForOrder,
  generateSecureLink, 
  sendVerificationEmail,
  updateDocumentStatus 
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

async function init() {
  try {
    // Fetch and render suppliers
    const suppliers = await fetchSuppliers();
    renderSuppliers(suppliers);

    // Fetch and render orders
    currentOrders = await fetchOrders();
    renderOrders(currentOrders);

    showMessage('Data loaded successfully', 'success');
  } catch (error) {
    console.error('Initialization error:', error);
    showMessage(error.message, 'error');
  }
}

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
    renderOrders(currentOrders);
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
