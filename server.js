const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const XLSX = require("xlsx");
const path = require("path");

const app = express();

// ===== MIDDLEWARE =====
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static("public"));

app.use(
  session({
    secret: "gang-secret-key",
    resave: false,
    saveUninitialized: true,
  })
);

// ===== FAKE USERS (DEMO) =====
const users = [
  { username: "leader1", password: "123", role: "leader" },
  { username: "member1", password: "123", role: "member" },
  { username: "member2", password: "123", role: "member" },
];

// ===== MEMORY STORAGE =====
let orders = [];

// ===== LOGIN =====
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  const user = users.find(
    (u) => u.username === username && u.password === password
  );

  if (!user) return res.send("Login Failed");

  req.session.user = user.username;
  req.session.role = user.role;

  res.redirect("/dashboard.html");
});

// ===== LOGOUT =====
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/login.html");
});

// ===== SUBMIT ORDER (MEMBER ONLY) =====
app.post("/order", (req, res) => {
  if (!req.session.user) {
    return res.status(401).send("Unauthorized");
  }

  if (req.session.role !== "member") {
    return res.status(403).send("Only member can submit order");
  }

  const { item, price, quantity } = req.body;

  const total = parseInt(price) * parseInt(quantity);

  orders.push({
    member: req.session.user,
    item,
    price: parseInt(price),
    quantity: parseInt(quantity),
    total,
    date: new Date().toLocaleString(),
  });

  res.send("Order Submitted");
});

// ===== VIEW ORDER HISTORY (EXCLUSIVE /account) =====
app.get("/account", (req, res) => {
  if (!req.session.user) {
    return res.status(401).send("Unauthorized");
  }

  // Leader sees all
  if (req.session.role === "leader") {
    return res.json(orders);
  }

  // Member sees only their own
  const myOrders = orders.filter(
    (order) => order.member === req.session.user
  );

  res.json(myOrders);
});

// ===== EXPORT EXCEL (LEADER ONLY) =====
app.get("/export", (req, res) => {
  if (!req.session.user || req.session.role !== "leader") {
    return res.status(403).send("Only leader can export");
  }

  const worksheet = XLSX.utils.json_to_sheet(orders);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Orders");

  const filePath = path.join(__dirname, "orders.xlsx");
  XLSX.writeFile(workbook, filePath);

  res.download(filePath);
});

// ===== PROTECTED DASHBOARD CHECK =====
app.get("/check-auth", (req, res) => {
  if (!req.session.user) {
    return res.status(401).send("Unauthorized");
  }

  res.json({
    user: req.session.user,
    role: req.session.role,
  });
});

// ===== PORT (Render Compatible) =====
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
