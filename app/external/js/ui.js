// app/external/js/ui.js

export function showMessage(message, type = 'success') {
  const container = document.getElementById('messageContainer');
  if (!container) return;

  const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
  
  const messageDiv = document.createElement('div');
  messageDiv.className = `${bgColor} text-white px-6 py-4 rounded-lg shadow-lg mb-4`;
  messageDiv.innerHTML = `
    <div class="flex items-center justify-between">
      <span>${escapeHtml(message)}</span>
      <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-white hover:text-gray-200">
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
        </svg>
      </button>
    </div>
  `;
  
  container.classList.remove('hidden');
  container.appendChild(messageDiv);
  
  setTimeout(() => {
    messageDiv.remove();
    if (container.children.length === 0) {
      container.classList.add('hidden');
    }
  }, 5000);
}

export function renderOrderInfo(order) {
  const supplierNameEl = document.getElementById('supplierName');
  const orderNumberEl = document.getElementById('orderNumber');
  const orderStatusEl = document.getElementById('orderStatus');
  const createdAtEl = document.getElementById('createdAt');
  const statusTextEl = document.getElementById('statusText');
  const deliveryConfirmedAtEl = document.getElementById('deliveryConfirmedAt');
  const deliveryNotesEl = document.getElementById('deliveryNotes');

  if (supplierNameEl) supplierNameEl.textContent = order.supplier?.name || 'Supplier';
  if (orderNumberEl) orderNumberEl.textContent = `Order: ${order.orderNumber || order.ID}`;
  
  if (orderStatusEl) {
    const status = order.status || 'PENDING';
    const statusColors = {
      'PENDING': 'bg-yellow-100 text-yellow-800',
      'LINK_SENT': 'bg-blue-100 text-blue-800',
      'VIEWED': 'bg-purple-100 text-purple-800',
      'CONFIRMED': 'bg-green-100 text-green-800'
    };
    orderStatusEl.className = `inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusColors[status] || 'bg-gray-100 text-gray-800'}`;
    orderStatusEl.textContent = status;
  }

  if (createdAtEl) {
    createdAtEl.textContent = order.createdAt ? new Date(order.createdAt).toLocaleString() : '—';
  }
  
  if (statusTextEl) statusTextEl.textContent = order.status || 'PENDING';
  
  if (deliveryConfirmedAtEl) {
    deliveryConfirmedAtEl.textContent = order.deliveryConfirmedAt 
      ? new Date(order.deliveryConfirmedAt).toLocaleString() 
      : '—';
  }
  
  if (deliveryNotesEl) {
    deliveryNotesEl.textContent = order.deliveryNotes || '—';
  }

  // Hide delivery form if already confirmed
  const deliveryFormSection = document.getElementById('deliveryFormSection');
  if (deliveryFormSection && order.status === 'CONFIRMED') {
    deliveryFormSection.style.display = 'none';
  }
}

export function renderDocuments(documents) {
  const tbody = document.getElementById('documentsTableBody');
  if (!tbody) return;

  if (!documents || documents.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="px-4 py-3 text-sm text-gray-500 text-center">No documents available</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = documents.map(doc => {
    const statusColors = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'approved': 'bg-green-100 text-green-800',
      'rejected': 'bg-red-100 text-red-800'
    };
    
    const statusClass = statusColors[doc.status_code] || 'bg-gray-100 text-gray-800';
    
    return `
      <tr class="hover:bg-gray-50">
        <td class="px-4 py-3 text-sm text-gray-900">${escapeHtml(doc.filename || doc.documentID)}</td>
        <td class="px-4 py-3 text-sm text-gray-500">${escapeHtml(doc.filetype || 'Unknown')}</td>
        <td class="px-4 py-3 text-sm text-gray-500">${escapeHtml(doc.uploadedBy || '—')}</td>
        <td class="px-4 py-3 text-sm">
          <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusClass}">
            ${escapeHtml(doc.status_code || 'pending')}
          </span>
        </td>
        <td class="px-4 py-3 text-sm text-gray-500">${escapeHtml(doc.adminFeedback || '—')}</td>
      </tr>
    `;
  }).join('');
}

export function setLoadingState(isLoading) {
  const deliveryForm = document.getElementById('confirmDeliveryForm');
  const uploadBtn = document.getElementById('uploadFileBtn');
  
  if (deliveryForm) {
    const submitBtn = deliveryForm.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = isLoading;
      submitBtn.textContent = isLoading ? 'Processing...' : 'Confirm Delivery';
    }
  }
  
  if (uploadBtn) {
    uploadBtn.disabled = isLoading;
  }
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
