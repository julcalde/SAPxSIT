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

export async function fetchMangel() {
  const data = await request("/Mangel?$expand=product,purchase");
  return data.value || [];
}

export async function fetchDelivery() {
  const data = await request("/Delivery?$select=delivered_on&$top=1");
  return (data.value && data.value[0]) || null;
}

export async function fetchCurrentOrder() {
  return request("/getCurrentOrder", { method: "POST" });
}

export async function setSellerConfirmed(confirmed) {
  return request("/setSellerConfirmed", {
    method: "POST",
    body: JSON.stringify({ confirmed: !!confirmed })
  });
}
