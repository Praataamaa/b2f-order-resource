let cart = [];

const prices = {
  Ammo: 5000,
  Vest: 15000,
  Pistol: 40000
};

async function checkRole() {
  const res = await fetch("/me");

  if (res.status !== 200) {
    window.location.href = "/login.html";
    return;
  }

  const data = await res.json();

  document.getElementById("roleDisplay").innerText =
    `Logged in as: ${data.username} (${data.role})`;

  if (data.role !== "leader") {
    document.getElementById("exportBtn").style.display = "none";
  }
}

function addToCart() {
  const item = document.getElementById("item").value;
  const quantity = parseInt(document.getElementById("quantity").value);

  if (!quantity || quantity <= 0) {
    alert("Invalid quantity");
    return;
  }

  cart.push({ name: item, quantity });
  document.getElementById("quantity").value = "";
  updateCart();
}

function updateCart() {
  const cartList = document.getElementById("cartList");
  cartList.innerHTML = "";

  let total = 0;

  cart.forEach((item, index) => {
    const li = document.createElement("li");
    const itemTotal = prices[item.name] * item.quantity;
    total += itemTotal;

    li.innerText =
      `${item.name} x${item.quantity} - $${itemTotal}`;

    const btn = document.createElement("button");
    btn.innerText = "X";
    btn.onclick = () => {
      cart.splice(index, 1);
      updateCart();
    };

    li.appendChild(btn);
    cartList.appendChild(li);
  });

  document.getElementById("grandTotal").innerText = total;
}

async function submitOrder() {
  if (cart.length === 0) return alert("Cart empty");

  await fetch("/order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cart })
  });

  cart = [];
  updateCart();
  loadOrders();
}

async function loadOrders() {
  const res = await fetch("/orders");
  if (res.status !== 200) return;

  const data = await res.json();
  const history = document.getElementById("history");
  history.innerHTML = "";

  data.forEach(order => {
    const li = document.createElement("li");

    const itemsText = order.items.map(i =>
      `${i.name} x${i.quantity}`
    ).join(", ");

    li.innerText =
      `${order.member} → ${itemsText} | $${order.total_price} (${order.date})`;

    history.appendChild(li);
  });
}

function exportExcel() {
  window.location.href = "/export";
}

function logout() {
  window.location.href = "/logout";
}

checkRole();
loadOrders();
