import {
  fetchPurchases,
  fetchMangel,
  fetchProducts,
  updateConfirmedQuantity
} from "./api.js";
import {
  renderLoading,
  renderPurchases,
  renderMangel,
  renderProducts,
  setStatus
} from "./ui.js";

const purchasesBody = document.getElementById("purchasesBody");
const mangelList = document.getElementById("mangelList");
const productsBody = document.getElementById("productsBody");
const statusEl = document.getElementById("mangelStatus");

async function loadAll() {
  renderLoading(purchasesBody);
  renderLoading(mangelList);
  renderLoading(productsBody);

  try {
    const [purchases, mangel, products] = await Promise.all([
      fetchPurchases(),
      fetchMangel(),
      fetchProducts()
    ]);

    renderPurchases(purchasesBody, purchases);
    renderMangel(mangelList, mangel);
    renderProducts(productsBody, products);
  } catch (err) {
    setStatus(statusEl, `Failed to load data: ${err.message}`, "err");
  }
}

mangelList.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-confirmed-save]");
  if (!btn) return;

  const row = btn.closest("[data-mangel-id]");
  if (!row) return;

  const input = row.querySelector("[data-confirmed-input]");
  const rawValue = input ? input.value : "";
  const mangelID = row.getAttribute("data-mangel-id");

  const confirmedQuantity = Number(rawValue);
  if (!Number.isInteger(confirmedQuantity) || confirmedQuantity < 0) {
    setStatus(statusEl, "ConfirmedQuantity must be an integer >= 0.", "err");
    return;
  }

  btn.disabled = true;
  setStatus(statusEl, "Saving...", "");

  try {
    await updateConfirmedQuantity(mangelID, confirmedQuantity);
    setStatus(statusEl, "Saved.", "ok");
  } catch (err) {
    setStatus(statusEl, `Save failed: ${err.message}`, "err");
  } finally {
    btn.disabled = false;
  }
});

loadAll();
