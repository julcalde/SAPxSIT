// app/admin/js/ui.js

export function showMessage(message, type = 'success') {
  const container = document.getElementById('messageContainer');
  if (!container) return;

  const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
  
  const messageDiv = document.createElement('div');
  messageDiv.className = `${bgColor} text-white px-6 py-4 rounded-lg shadow-lg mb-4 max-w-md`;
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

export function renderSuppliers(suppliers) {
  const tbody = document.getElementById('suppliersTableBody');
  if (!tbody) return;

  if (!suppliers || suppliers.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3" class="px-6 py-4 text-sm text-gray-500 text-center">No suppliers found</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = suppliers.map(supplier => `
    <tr class="hover:bg-gray-50">
      <td class="px-6 py-4 text-sm text-gray-900">${escapeHtml(supplier.supplierID || supplier.ID)}</td>
      <td class="px-6 py-4 text-sm text-gray-900">${escapeHtml(supplier.name || '—')}</td>
      <td class="px-6 py-4 text-sm text-gray-500">${escapeHtml(supplier.email || '—')}</td>
    </tr>
  `).join('');
}

export function renderOrders(orders, onGenerateLink, onSendEmail, onViewDocuments) {
  const tbody = document.getElementById('ordersTableBody');
  if (!tbody) return;

  if (!orders || orders.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="px-6 py-4 text-sm text-gray-500 text-center">No orders found</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = orders.map(order => {
    const statusColors = {
      'PENDING': 'bg-yellow-100 text-yellow-800',
      'LINK_SENT': 'bg-blue-100 text-blue-800',
      'VIEWED': 'bg-purple-100 text-purple-800',
      'CONFIRMED': 'bg-green-100 text-green-800'
    };
    
    const statusClass = statusColors[order.status] || 'bg-gray-100 text-gray-800';
    
    const deliveryInfo = order.status === 'CONFIRMED' && order.deliveryConfirmedAt
      ? `<div class="text-xs text-gray-500 mt-1">${new Date(order.deliveryConfirmedAt).toLocaleDateString()}</div>
         ${order.deliveryNotes ? `<div class="text-xs text-gray-500 italic">${escapeHtml(order.deliveryNotes)}</div>` : ''}`
      : '<span class="text-sm text-gray-400">—</span>';

    return `
      <tr class="hover:bg-gray-50">
        <td class="px-6 py-4 text-sm text-gray-900">${escapeHtml(order.orderNumber || order.ID)}</td>
        <td class="px-6 py-4 text-sm text-gray-500">${escapeHtml(order.supplier?.name || '—')}</td>
        <td class="px-6 py-4 text-sm">
          <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusClass}">
            ${escapeHtml(order.status || 'PENDING')}
          </span>
        </td>
        <td class="px-6 py-4 text-sm">${deliveryInfo}</td>
        <td class="px-6 py-4 text-sm text-right space-x-2">
          <button 
            onclick="window.handleGenerateLink('${order.ID}')"
            class="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200"
          >
            Generate Link
          </button>
          <button 
            onclick="window.handleSendEmail('${order.ID}')"
            class="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-green-700 bg-green-100 hover:bg-green-200"
          >
            Send Email
          </button>
          <button 
            onclick="window.handleViewDocuments('${order.ID}', '${escapeHtml(order.orderNumber || order.ID)}')"
            class="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200"
          >
            View Documents
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

export function renderDocuments(documents, onUpdateStatus) {
  const tbody = document.getElementById('documentsTableBody');
  if (!tbody) return;

  if (!documents || documents.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="px-6 py-4 text-sm text-gray-500 text-center">No documents found for this order</td>
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
        <td class="px-6 py-4 text-sm text-gray-900">${escapeHtml(doc.documentID || doc.ID)}</td>
        <td class="px-6 py-4 text-sm text-gray-900">${escapeHtml(doc.filename || '—')}</td>
        <td class="px-6 py-4 text-sm text-gray-500">${escapeHtml(doc.uploadedBy || '—')}</td>
        <td class="px-6 py-4 text-sm">
          <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusClass}">
            ${escapeHtml(doc.status_code || 'pending')}
          </span>
        </td>
        <td class="px-6 py-4 text-sm text-gray-500">${escapeHtml(doc.adminFeedback || '—')}</td>
        <td class="px-6 py-4 text-sm text-right">
          <button 
            onclick="window.handleUpdateStatus('${doc.ID}', '${doc.status_code || 'pending'}', '${escapeHtml(doc.adminFeedback || '')}')"
            class="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200"
          >
            Update Status
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

export function showLinkModal(link, expiresAt) {
  const modal = document.getElementById('linkModal');
  const linkEl = document.getElementById('generatedLink');
  const expiryEl = document.getElementById('linkExpiry');
  
  if (modal && linkEl && expiryEl) {
    linkEl.textContent = link;
    expiryEl.textContent = new Date(expiresAt).toLocaleString();
    modal.classList.remove('hidden');
  }
}

export function hideLinkModal() {
  const modal = document.getElementById('linkModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

export function showStatusModal(documentID, currentStatus, currentFeedback) {
  const modal = document.getElementById('statusModal');
  const docIDInput = document.getElementById('statusDocumentID');
  const statusSelect = document.getElementById('statusCode');
  const feedbackTextarea = document.getElementById('adminFeedback');
  
  if (modal && docIDInput && statusSelect && feedbackTextarea) {
    docIDInput.value = documentID;
    statusSelect.value = currentStatus || 'pending';
    feedbackTextarea.value = currentFeedback || '';
    modal.classList.remove('hidden');
  }
}

export function hideStatusModal() {
  const modal = document.getElementById('statusModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

export function showDocumentsSection(orderNumber) {
  const section = document.getElementById('documentsSection');
  const orderNumberEl = document.getElementById('selectedOrderNumber');
  
  if (section) {
    section.classList.remove('hidden');
    if (orderNumberEl) {
      orderNumberEl.textContent = orderNumber;
    }
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
