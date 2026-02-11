function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return "—";
  }
}

export function renderLoading(container) {
  container.innerHTML = `
    <div class="loading">
      <span>Loading</span>
      <span class="dot"></span>
      <span class="dot"></span>
      <span class="dot"></span>
    </div>
  `;
}

export function renderPurchases(container, purchases) {
  container.innerHTML = purchases
    .map((p) => {
      const productName = p.product?.name ?? "—";
      const qty = p.quantity ?? "—";
      const date = formatDate(p.date);
      return `
        <tr>
          <td>${escapeHtml(productName)}</td>
          <td>${escapeHtml(qty)}</td>
          <td>${escapeHtml(date)}</td>
        </tr>
      `;
    })
    .join("");

  if (!purchases.length) {
    container.innerHTML = `
      <tr><td colspan="3">No purchases found.</td></tr>
    `;
  }
}

export function renderProducts(container, products) {
  container.innerHTML = products
    .map((p) => {
      const price = p.price ?? "—";
      const currency = p.Currency ?? "—";
      return `
        <tr>
          <td>${escapeHtml(p.name ?? "—")}</td>
          <td>${escapeHtml(price)}</td>
          <td>${escapeHtml(currency)}</td>
        </tr>
      `;
    })
    .join("");

  if (!products.length) {
    container.innerHTML = `
      <tr><td colspan="3">No products found.</td></tr>
    `;
  }
}

export function renderMangel(container, mangel) {
  container.innerHTML = mangel
    .map((m) => {
      const productName = m.product?.name ?? "—";
      const ist = m.istQuantity ?? "—";
      const diff = m.differenceQuantity ?? "—";
      const declinedQty = m.DeclinedQuantity ?? "—";
      const declinedReason = m.DeclinedReason ?? "—";

      return `
        <div class="mangel-row">
          <div class="mangel-meta">
            <div><strong>${escapeHtml(productName)}</strong></div>
            <div class="pill">Ist: ${escapeHtml(ist)} • Diff: ${escapeHtml(diff)}</div>
            <div class="pill">Declined Qty: ${escapeHtml(declinedQty)}</div>
            <div class="pill">Reason: ${escapeHtml(declinedReason)}</div>
          </div>
        </div>
      `;
    })
    .join("");

  if (!mangel.length) {
    container.innerHTML = `<div>No mangel records found.</div>`;
  }
}

export function setOrderHeader(orderIdEl, statusEl, order) {
  const id = order && order.ID ? order.ID : "—";
  const confirmed = !!(order && order.sellerConfirmed);
  orderIdEl.textContent = id;
  statusEl.textContent = confirmed ? "Confirmed" : "Pending";
  statusEl.classList.toggle("badge-ok", confirmed);
  statusEl.classList.toggle("badge-pending", !confirmed);
}

export function setStatus(el, msg, type) {
  el.textContent = msg;
  el.classList.remove("ok", "err");
  if (type) el.classList.add(type);
}
