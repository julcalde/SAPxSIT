import {
  fetchPurchases,
  fetchMangel,
  fetchProducts,
  fetchCurrentOrder,
  setSellerConfirmed
} from "./api.js";
import {
  renderLoading,
  renderPurchases,
  renderMangel,
  renderProducts,
  setStatus,
  setOrderHeader
} from "./ui.js";

const purchasesBody = document.getElementById("purchasesBody");
const mangelList = document.getElementById("mangelList");
const productsBody = document.getElementById("productsBody");
const statusEl = document.getElementById("mangelStatus");
const confirmBtn = document.getElementById("confirmBtn");
const orderIdEl = document.getElementById("orderId");
const orderStatusEl = document.getElementById("orderStatus");

async function loadOrderHeader() {
  const order = await fetchCurrentOrder();
  setOrderHeader(orderIdEl, orderStatusEl, order);
  return order;
}

async function loadAll() {
  renderLoading(purchasesBody);
  renderLoading(mangelList);
  renderLoading(productsBody);

  try {
    const [purchases, mangel, products, order] = await Promise.all([
      fetchPurchases(),
      fetchMangel(),
      fetchProducts(),
      loadOrderHeader()
    ]);

    renderPurchases(purchasesBody, purchases);
    renderMangel(mangelList, mangel);
    renderProducts(productsBody, products);
    toggleConfirmButton(order);
  } catch (err) {
    setStatus(statusEl, `Failed to load data: ${err.message}`, "err");
  }
}

function toggleConfirmButton(order) {
  const confirmed = !!(order && order.sellerConfirmed);
  confirmBtn.textContent = confirmed ? "Unconfirm" : "Confirm";
  confirmBtn.dataset.confirmed = confirmed ? "true" : "false";
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
