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
