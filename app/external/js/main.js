import { fetchMangel, fetchDelivery, fetchCurrentOrder, setSellerConfirmed } from "./api.js";
import { renderLoading, renderItems, setOrderHeader, setStatus } from "./ui.js";

const itemsBody = document.getElementById("itemsBody");
const statusEl = document.getElementById("mangelStatus");
const confirmBtn = document.getElementById("confirmBtn");
const orderIdEl = document.getElementById("orderId");
const orderStatusEl = document.getElementById("orderStatus");

async function loadOrderHeader() {
  const order = await fetchCurrentOrder();
  setOrderHeader(orderIdEl, orderStatusEl, order);
  toggleConfirmButton(order);
  return order;
}

function toggleConfirmButton(order) {
  const confirmed = !!(order && order.sellerConfirmed);
  confirmBtn.textContent = confirmed ? "Unconfirm" : "Confirm";
  confirmBtn.dataset.confirmed = confirmed ? "true" : "false";
}

async function loadAll() {
  renderLoading(itemsBody);

  try {
    const [mangel, delivery, order] = await Promise.all([
      fetchMangel(),
      fetchDelivery(),
      loadOrderHeader()
    ]);

    renderItems(itemsBody, mangel, delivery && delivery.delivered_on);
    toggleConfirmButton(order);
  } catch (err) {
    setStatus(statusEl, `Failed to load data: ${err.message}`, "err");
  }
}

confirmBtn.addEventListener("click", async () => {
  const current = confirmBtn.dataset.confirmed === "true";
  const next = !current;

  confirmBtn.disabled = true;
  setStatus(statusEl, next ? "Confirming..." : "Unconfirming...", "");

  try {
    const order = await setSellerConfirmed(next);
    setOrderHeader(orderIdEl, orderStatusEl, order);
    toggleConfirmButton(order);
    setStatus(statusEl, next ? "Order confirmed." : "Order unconfirmed.", "ok");
  } catch (err) {
    setStatus(statusEl, `Update failed: ${err.message}`, "err");
  } finally {
    confirmBtn.disabled = false;
  }
});

loadAll();
