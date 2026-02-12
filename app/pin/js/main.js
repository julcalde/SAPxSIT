const params = new URLSearchParams(window.location.search);
const token = params.get("token");
const redirect = params.get("redirect") || "/external/index.html";

const pinInput = document.getElementById("pinInput");
const pinBtn = document.getElementById("pinBtn");
const statusEl = document.getElementById("status");

function setStatus(msg) {
  statusEl.textContent = msg || "";
}

async function submitPin() {
  if (!token) {
    setStatus("Missing token in link.");
    return;
  }
  const pin = pinInput.value.trim();
  if (!/^[0-9]{4}$/.test(pin)) {
    setStatus("PIN must be 4 digits.");
    return;
  }

  pinBtn.disabled = true;
  setStatus("");

  try {
    const res = await fetch("/service/deliveryTokenVerify/verifyPin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      credentials: "include",
      body: JSON.stringify({ token, pin })
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "PIN verification failed");
    }

    window.location.href = redirect;
  } catch (err) {
    setStatus(err.message);
  } finally {
    pinBtn.disabled = false;
  }
}

pinBtn.addEventListener("click", submitPin);
pinInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitPin();
});
