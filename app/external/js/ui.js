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
    <tr>
      <td colspan="6">
        <div class="loading">
          <span>Loading</span>
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
      </td>
    </tr>
  `;
}

export function renderItems(container, mangel, deliveredOn) {
  const deliveredLabel = formatDate(deliveredOn);
  container.innerHTML = mangel
    .map((m) => {
      const productName = m.product?.name ?? "—";
      const orderedQty = m.purchase?.quantity ?? "—";
      const deliveredQty = m.istQuantity ?? "—";
      const declinedQty = m.DeclinedQuantity ?? "—";
      const declinedReason = m.DeclinedReason ?? "—";

      return `
        <tr>
          <td>${escapeHtml(productName)}</td>
          <td>${escapeHtml(orderedQty)}</td>
          <td>${escapeHtml(deliveredLabel)}</td>
          <td>${escapeHtml(deliveredQty)}</td>
          <td>${escapeHtml(declinedQty)}</td>
          <td>${escapeHtml(declinedReason)}</td>
        </tr>
      `;
    })
    .join("");

  if (!mangel.length) {
    container.innerHTML = `
      <tr><td colspan="6">No items found.</td></tr>
    `;
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
