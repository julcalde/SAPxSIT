// app/external/js/main.js
import { fetchOrders, fetchDocuments, confirmDelivery, uploadDocument, hasValidSession, downloadDocument } from './api.js';
import { showMessage, renderOrderInfo, renderDocuments, setLoadingState } from './ui.js';

async function init() {
  console.log('[External] Page loaded, URL:', window.location.href);
  
  // IMPORTANT: Extract and save session token from URL FIRST
  const urlParams = new URLSearchParams(window.location.search);
  const urlToken = urlParams.get('sessionToken');
  
  console.log('[External] Session token in URL:', urlToken ? 'YES (length: ' + urlToken.length + ')' : 'NO');
  
  if (urlToken) {
    try {
      // Use localStorage instead of cookies (more reliable for JWT tokens)
      localStorage.setItem('external_session', urlToken);
      
      // Also set as cookie for BAS proxy compatibility
      document.cookie = `external_session=${urlToken}; path=/; max-age=86400; SameSite=Lax`;
      
      console.log('[External] Session token saved to localStorage');
      console.log('[External] Verification:', localStorage.getItem('external_session') ? 'FOUND' : 'NOT FOUND');
      
    } catch (error) {
      console.error('[External] Error saving token:', error);
    }
    
    // Clean URL by removing the token parameter
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
    
    console.log('[External] URL cleaned to:', cleanUrl);
  }
  
  // Check if user has valid session
  if (!hasValidSession()) {
    // Show diagnostic info
    const cookies = document.cookie;
    console.error('[External] No session found. Current cookies:', cookies);
    console.error('[External] URL after processing:', window.location.href);
    
    showMessage('No valid session found. Please use the verification link sent to you.', 'error');
    
    const deliverySection = document.getElementById('deliveryFormSection');
    const uploadBtn = document.getElementById('uploadFileBtn');
    if (deliverySection) deliverySection.style.display = 'none';
    if (uploadBtn) uploadBtn.style.display = 'none';
    
    // Show helpful message in the main content area
    const mainContent = document.querySelector('.max-w-7xl');
    if (mainContent) {
      const messageDiv = document.createElement('div');
      messageDiv.className = 'mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded';
      messageDiv.innerHTML = `
        <p class="text-sm text-yellow-800 mb-2"><strong>Troubleshooting:</strong></p>
        <ul class="text-xs text-yellow-700 list-disc list-inside space-y-1">
          <li>Make sure you're using the full verification link</li>
          <li>Try opening the link in a new private/incognito window</li>
          <li>Check if cookies are enabled in your browser</li>
          <li>Current cookies: ${cookies || 'none'}</li>
        </ul>
      `;
      mainContent.appendChild(messageDiv);
    }
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
      
      // Re-fetch order data to show updated status (don't reload page)
      setTimeout(async () => {
        try {
          const orders = await fetchOrders();
          if (orders && orders.length > 0) {
            renderOrderInfo(orders[0]);
          }
        } catch (error) {
          console.error('Error refreshing order data:', error);
        }
      }, 1000);
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

// Document download handler
window.handleDownloadDocument = async function(docID, filename) {
  try {
    showMessage('Downloading document...', 'info');
    await downloadDocument(docID);
    showMessage('Document downloaded successfully', 'success');
  } catch (error) {
    console.error('Download error:', error);
    showMessage('Failed to download document: ' + error.message, 'error');
  }
};

// Initialize app
init().catch(err => {
  console.error('Fatal initialization error:', err);
  showMessage('Failed to initialize application: ' + err.message, 'error');
});
