// app/external/js/main.js
import { fetchOrders, fetchDocuments, confirmDelivery, uploadDocument, hasValidSession } from './api.js';
import { showMessage, renderOrderInfo, renderDocuments, setLoadingState } from './ui.js';

async function init() {
  // Check if user has valid session
  if (!hasValidSession()) {
    showMessage('No valid session found. Please use the verification link sent to you.', 'error');
    document.getElementById('deliveryFormSection').style.display = 'none';
    document.getElementById('uploadFileBtn').style.display = 'none';
    return;
  }

  try {
    // Fetch order data
    const orders = await fetchOrders();
    
    if (!orders || orders.length === 0) {
      showMessage('No order data found.', 'error');
      return;
    }

    const order = orders[0]; // External users should only see one order
    renderOrderInfo(order);

    // Fetch documents
    const documents = await fetchDocuments();
    renderDocuments(documents);

    showMessage('Order data loaded successfully', 'success');
  } catch (error) {
    console.error('Initialization error:', error);
    showMessage(error.message, 'error');
  }
}

// Delivery confirmation form handler
const deliveryForm = document.getElementById('confirmDeliveryForm');
if (deliveryForm) {
  deliveryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const deliveryDate = document.getElementById('deliveryDate').value;
    const notes = document.getElementById('deliveryNotesInput').value;

    if (!deliveryDate) {
      showMessage('Please select a delivery date', 'error');
      return;
    }

    try {
      setLoadingState(true);
      
      const result = await confirmDelivery(deliveryDate, notes);
      
      showMessage(result.message || 'Delivery confirmed successfully!', 'success');
      
      // Refresh order data to show updated status
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Delivery confirmation error:', error);
      showMessage(error.message, 'error');
    } finally {
      setLoadingState(false);
    }
  });
}

// File upload handler
const uploadBtn = document.getElementById('uploadFileBtn');
const fileInput = document.getElementById('fileUploadInput');

if (uploadBtn && fileInput) {
  uploadBtn.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      showMessage('Please upload PDF, JPG, or PNG files only.', 'error');
      fileInput.value = '';
      return;
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      showMessage('File size must be less than 10MB.', 'error');
      fileInput.value = '';
      return;
    }

    try {
      setLoadingState(true);
      showMessage('Uploading document...', 'info');
      
      const result = await uploadDocument(file);
      
      showMessage('Document uploaded successfully!', 'success');
      
      // Refresh documents list
      const documents = await fetchDocuments();
      renderDocuments(documents);
    } catch (error) {
      console.error('Upload error:', error);
      showMessage(error.message, 'error');
    } finally {
      setLoadingState(false);
      fileInput.value = '';
    }
  });
}

// Initialize app
init().catch(err => {
  console.error('Fatal initialization error:', err);
  showMessage('Failed to initialize application: ' + err.message, 'error');
});
