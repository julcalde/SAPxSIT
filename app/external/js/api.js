// app/external/js/api.js
const SERVICE_URL = '/service/external';

function getSessionToken() {
  // Get session token from cookie
  const cookies = document.cookie.split(';');
  for (let cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'external_session') {
      return value;
    }
  }
  
  // Fallback: check URL params
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('sessionToken');
}

async function fetchWithAuth(url, options = {}) {
  const token = getSessionToken();
  
  if (!token) {
    throw new Error('No session token found. Please use the verification link provided.');
  }

  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`
  };

  const response = await fetch(url, { ...options, headers });
  
  if (response.status === 401) {
    throw new Error('Session expired or invalid. Please request a new verification link.');
  }
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error: ${response.status} - ${errorText}`);
  }
  
  return response;
}

export async function fetchOrders() {
  const response = await fetchWithAuth(`${SERVICE_URL}/Orders`);
  const data = await response.json();
  return data.value || [];
}

export async function fetchDocuments() {
  const response = await fetchWithAuth(`${SERVICE_URL}/Documents`);
  const data = await response.json();
  return data.value || [];
}

export async function confirmDelivery(deliveryDate, notes) {
  const response = await fetchWithAuth(`${SERVICE_URL}/confirmDelivery`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      deliveryDate,
      notes: notes || ''
    })
  });
  
  return await response.json();
}

export async function uploadDocument(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('filename', file.name);
  formData.append('contentType', file.type);

  // Note: For now, we'll use a simple approach
  // In production, you might want to use multipart/form-data or base64 encoding
  const response = await fetchWithAuth(`${SERVICE_URL}/uploadDocument`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      data: await fileToBase64(file)
    })
  });
  
  return await response.json();
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      // Remove data:*/*;base64, prefix
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
}

export function hasValidSession() {
  return !!getSessionToken();
}
