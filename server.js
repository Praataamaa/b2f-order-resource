const express = require("express");
const session = require("express-session");
const ExcelJS = require("exceljs");
const axios = require("axios");
const path = require("path");

const app = express();
const PORT = 3000;

const DISCORD_WEBHOOK = "PASTE_YOUR_WEBHOOK_URL";

// MIDDLEWARE
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: "super-secret-key",
  resave: false,
  saveUninitialized: false
}));

app.use(express.static(path.join(__dirname, "public")));

// USERS WITH ROLES
const users = {
  leader: { password: "1234", role: "leader" },
  member1: { password: "1234", role: "member" },
  member2: { password: "1234", role: "member" }
};

let orders = [];

/* ===========================
   AUTH ROUTES
=========================== */

// LOGIN
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (users[username] && users[username].password === password) {
    req.session.user = username;
    req.session.role = users[username].role;
    return res.redirect("/dashboard.html");
  }

  res.send("Invalid username or password");
});

// LOGOUT
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login.html");
  });
});

// CURRENT USER INFO
app.get("/me", (req, res) => {
  if (!req.session.user)
    return res.status(401).send("Unauthorized");

  res.json({
    username: req.session.user,
    role: req.session.role
  });
});

/* ===========================
   ORDER ROUTES
=========================== */

// SUBMIT ORDER
app.post("/order", async (req, res) => {
  if (!req.session.user)
    return res.status(401).send("Unauthorized");

  const { cart } = req.body;

  if (!cart || cart.length === 0)
    return res.status(400).send("Cart empty");

  const prices = {
    Ammo: 5000,
    Vest: 15000,
    Pistol: 40000
  };

  let total_price = 0;

  cart.forEach(item => {
    if (prices[item.name]) {
      total_price += prices[item.name] * item.quantity;
    }
  });

  const order = {
    member: req.session.user,
    items: cart,
    total_price,
    date: new Date().toLocaleString()
  };

  orders.push(order);

  // DISCORD NOTIFICATION
  if (DISCORD_WEBHOOK !== "PASTE_YOUR_WEBHOOK_URL") {
    const itemList = cart.map(i =>
      `• ${i.name} x${i.quantity}`
    ).join("\n");

    try {
      await axios.post(DISCORD_WEBHOOK, {
        content: `🚨 NEW ORDER
👤 Member: ${order.member}
📦 Items:
${itemList}
💰 Total: $${order.total_price}
📅 ${order.date}`
      });
    } catch (err) {
      console.log("Webhook failed");
    }
  }

  res.json({ success: true });
});

// EXCLUSIVE ORDER HISTORY
app.get("/orders", (req, res) => {
  if (!req.session.user)
    return res.status(401).send("Unauthorized");

  // LEADER sees all
  if (req.session.role === "leader") {
    return res.json(orders);
  }

  // MEMBER sees only own
  const myOrders = orders.filter(order =>
    order.member === req.session.user
  );

  return res.json(myOrders);
});

// EXPORT EXCEL (LEADER ONLY)
app.get("/export", async (req, res) => {
  if (!req.session.user)
    return res.status(401).send("Unauthorized");

  if (req.session.role !== "leader")
    return res.status(403).send("Access Denied - Leader Only");

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Orders");

  sheet.columns = [
    { header: "Member", key: "member" },
    { header: "Items", key: "items" },
    { header: "Total Price", key: "total" },
    { header: "Date", key: "date" }
  ];

  orders.forEach(order => {
    const itemText = order.items.map(i =>
      `${i.name} x${i.quantity}`
    ).join(", ");

    sheet.addRow({
      member: order.member,
      items: itemText,
      total: order.total_price,
      date: order.date
    });
  });

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );

  res.setHeader(
    "Content-Disposition",
    "attachment; filename=orders.xlsx"
  );

  await workbook.xlsx.write(res);
  res.end();
});

// START SERVER
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
