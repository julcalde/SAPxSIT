// app/admin/js/api.js
const SERVICE_URL = '/service/internal';

async function fetchJSON(url, options = {}) {
  const response = await fetch(url, options);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error: ${response.status} - ${errorText}`);
  }
  
  return await response.json();
}

export async function fetchSuppliers() {
  const data = await fetchJSON(`${SERVICE_URL}/Suppliers`);
  return data.value || [];
}

export async function createSupplier(name, email) {
  const response = await fetch(`${SERVICE_URL}/createSupplier`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name, email })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create supplier: ${response.status} - ${errorText}`);
  }
  
  return await response.json();
}

export async function createOrderAndToken(supplierId) {
  const response = await fetch(`${SERVICE_URL}/createOrderAndToken`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ supplierId })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create order: ${response.status} - ${errorText}`);
  }
  
  return await response.json();
}

export async function fetchOrders() {
  const data = await fetchJSON(`${SERVICE_URL}/Orders?$expand=supplier`);
  return data.value || [];
}

export async function fetchDocumentsForOrder(orderID) {
  const filter = encodeURIComponent(`order_ID eq '${orderID}'`);
  const data = await fetchJSON(`${SERVICE_URL}/Documents?$filter=${filter}`);
  return data.value || [];
}

export async function generateSecureLink(orderID) {
  const response = await fetch(`${SERVICE_URL}/generateSecureLink`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ orderID })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to generate link: ${response.status} - ${errorText}`);
  }
  
  return await response.json();
}

export async function sendVerificationEmail(orderID) {
  const response = await fetch(`${SERVICE_URL}/sendVerificationEmail`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ orderID })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send email: ${response.status} - ${errorText}`);
  }
  
  return await response.json();
}

export async function updateDocumentStatus(documentID, statusCode, feedback) {
  const response = await fetch(`${SERVICE_URL}/updateDocumentStatus`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      documentID,
      statusCode,
      feedback: feedback || null
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update status: ${response.status} - ${errorText}`);
  }
  
  return await response.json();
}

export async function fetchAccessTokensForOrder(orderID) {
  const filter = encodeURIComponent(`order_ID eq '${orderID}'`);
  const data = await fetchJSON(`${SERVICE_URL}/AccessTokens?$filter=${filter}`);
  return data.value || [];
}

export function getDocumentDownloadUrl(docID) {
  if (!docID) return null;
  return `${SERVICE_URL}/Documents(ID=${docID},IsActiveEntity=true)/content/$value`;
}

export async function uploadDocumentContent(docID, file) {
  if (!docID) throw new Error('missing docID');
  const url = `${SERVICE_URL}/Documents(ID=${docID},IsActiveEntity=true)/content/$value`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type || 'application/pdf',
      'x-file-name': file.name
    },
    body: file
  });
  if (!response.ok) throw new Error(`uploadDocumentContent failed: ${response.status}`);
  return true;
}

export async function createDocumentForOrder(orderID, documentID, filetype) {
  const payload = {
    documentID: String(documentID),
    filetype: filetype || 'application/pdf',
    order_ID: orderID,
    uploadedBy: 'admin'
  };
  const response = await fetch(`${SERVICE_URL}/Documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`createDocument failed: ${response.status}`);
  try {
    return await response.json();
  } catch (e) {
    const loc = response.headers.get('Location') || response.headers.get('location');
    if (loc) {
      const m = loc.match(/Documents\(ID=([^,]+),/);
      if (m) return { ID: m[1] };
    }
    return {};
  }
}

export async function deleteDocument(docID) {
  if (!docID) throw new Error('missing docID');
  const url = `${SERVICE_URL}/Documents(ID=${docID},IsActiveEntity=true)`;
  const response = await fetch(url, { method: 'DELETE' });
  if (!response.ok) throw new Error(`deleteDocument failed: ${response.status}`);
  return true;
}
