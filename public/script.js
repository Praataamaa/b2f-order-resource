async function calculateTotal() {
  const itemSelect = document.getElementById("item");
  const quantity = parseInt(document.getElementById("quantity").value) || 0;
  const price = parseInt(
    itemSelect.options[itemSelect.selectedIndex].getAttribute("data-price")
  );

  const total = price * quantity;
  document.getElementById("total").innerText = total.toLocaleString();
}

async function submitOrder() {
  const itemSelect = document.getElementById("item");
  const quantity = document.getElementById("quantity").value;
  const price = itemSelect.options[itemSelect.selectedIndex].getAttribute("data-price");

  if (!quantity || quantity <= 0) {
    alert("Invalid quantity");
    return;
  }

  await fetch("/order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item: itemSelect.value, price, quantity }),
  });

  alert("Order submitted");
  loadOrders();
}

async function loadOrders() {
  const res = await fetch("/account");
  const data = await res.json();

  const list = document.getElementById("orders");
  list.innerHTML = "";

  data.forEach(order => {
    const li = document.createElement("li");
    li.innerText =
      `${order.member} - ${order.item} x${order.quantity} ($${order.total})`;
    list.appendChild(li);
  });
}

async function checkAuth() {
  const res = await fetch("/check-auth");
  const data = await res.json();

  document.getElementById("roleInfo").innerText =
    `Logged in as ${data.user} (${data.role})`;

  if (data.role !== "leader") {
    document.getElementById("exportBtn").style.display = "none";
  }
}

checkAuth();
loadOrders();
