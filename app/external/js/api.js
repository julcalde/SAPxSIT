const SERVICE_URL = "/service/accessPageExternal";

async function request(path, options = {}) {
  const res = await fetch(`${SERVICE_URL}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Request failed ${res.status}: ${text}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

export async function fetchPurchases() {
  const data = await request("/Purchases?$expand=product");
  return data.value || [];
}

export async function fetchMangel() {
  const data = await request("/Mangel?$expand=product,purchase");
  return data.value || [];
}

export async function fetchProducts() {
  const data = await request("/Products");
  return data.value || [];
}

export async function updateConfirmedQuantity(mangelID, confirmedQuantity) {
  return request("/updateConfirmedQuantity", {
    method: "POST",
    body: JSON.stringify({ mangelID, confirmedQuantity })
  });
}
