require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");
const ExcelJS = require("exceljs");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

/* =========================
   DATABASE
========================= */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes("railway")
    ? { rejectUnauthorized: false }
    : false
});

async function query(sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return rows;
}

/* =========================
   INIT TABLES
========================= */

async function initDB() {

  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(100) UNIQUE,
      password VARCHAR(255),
      role VARCHAR(20)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS items (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100),
      price INT
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      username VARCHAR(100),
      item VARCHAR(100),
      qty INT,
      price INT,
      total INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await seedData();
  console.log("Database ready");
}

/* =========================
   SEED DATA
========================= */

async function seedData() {

  const leader = await query(
    "SELECT * FROM users WHERE username=$1",
    ["leader"]
  );

  if (!leader.length) {
    const hashed = await bcrypt.hash("leader123", 10);

    await query(
      "INSERT INTO users (username,password,role) VALUES ($1,$2,$3)",
      ["leader", hashed, "leader"]
    );

    console.log("Leader seeded (leader / leader123)");
  }

  const items = await query("SELECT * FROM items");

  if (!items.length) {
    await query(
      "INSERT INTO items (name,price) VALUES ($1,$2),($3,$4),($5,$6)",
      ["Pistol",40000,"Vest",3000,"Ammo",7500]
    );

    console.log("Items seeded");
  }
}

/* =========================
   TIME WIB
========================= */

function toWIB(date) {
  return new Date(date).toLocaleString("en-GB", {
    timeZone: "Asia/Jakarta",
    hour12: false
  });
}

/* =========================
   LOGIN
========================= */

app.post("/login", async (req,res)=>{
  const { username, password } = req.body;

  const users = await query(
    "SELECT * FROM users WHERE username=$1",
    [username]
  );

  if(!users.length) return res.json({success:false});

  const user = users[0];

  const match = await bcrypt.compare(password,user.password);

  if(!match) return res.json({success:false});

  res.json({
    success: true,
    role: user.role
  });
});

/* =========================
   GET ITEMS
========================= */

app.get("/items", async (req,res)=>{
  const items = await query("SELECT * FROM items");
  res.json(items);
});

/* =========================
   CREATE USER
========================= */

app.post("/create-user", async (req,res)=>{
  const {username,password,role} = req.body;

  const hashed = await bcrypt.hash(password,10);

  await query(
    "INSERT INTO users (username,password,role) VALUES ($1,$2,$3)",
    [username,hashed,role]
  );

  res.json({success:true});
});

/* =========================
   SUBMIT ORDER
========================= */

app.post("/order", async (req,res)=>{
  const {username, cart} = req.body;

  for(const item of cart){
    await query(
      "INSERT INTO orders (username,item,qty,price,total) VALUES ($1,$2,$3,$4,$5)",
      [username,item.name,item.qty,item.price,item.total]
    );
  }

  res.json({success:true});
});

/* =========================
   GET ORDERS (GROUP PER SUBMIT)
========================= */

app.get("/orders/:username/:role", async (req,res)=>{
  const {username,role} = req.params;

  let orders;
  if (role === "leader") {
    orders = await query("SELECT * FROM orders ORDER BY created_at DESC");
  } else {
    orders = await query("SELECT * FROM orders WHERE username=$1 ORDER BY created_at DESC", [username]);
  }

  const grouped = {};

  orders.forEach(o => {

    const key = o.username + "_" + o.created_at;

    if(!grouped[key]){
      grouped[key] = {
        username: o.username,
        items: [],
        total: 0,
        time: toWIB(o.created_at)
      };
    }

    grouped[key].items.push(
      `${o.item} x${o.qty} ($${o.total.toLocaleString()})`
    );

    grouped[key].total += o.total;
  });

  res.json(Object.values(grouped));
});


/* =========================
   EXPORT EXCEL (MATCH ORDER HISTORY WITH FORMATTED TOTAL)
========================= */

app.get("/export/:username/:role", async (req, res) => {
  const { username, role } = req.params;

  let orders;

  if (role === "leader") {
    orders = await query("SELECT * FROM orders ORDER BY created_at DESC");
  } else {
    orders = await query(
      "SELECT * FROM orders WHERE username=$1 ORDER BY created_at DESC",
      [username]
    );
  }

  const grouped = {};

  orders.forEach(o => {
    const key = `${o.username}_${o.created_at}`;

    if (!grouped[key]) {
      grouped[key] = {
        username: o.username,
        items: [],
        total: 0,
        time: toWIB(o.created_at)
      };
    }

    grouped[key].items.push(`• ${o.item} x${o.qty} ($${o.total.toLocaleString()})`);
    grouped[key].total += o.total;
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Orders");

  sheet.columns = [
    { header: "User", key: "username", width: 20 },
    { header: "Item", key: "items", width: 60 },
    { header: "Total ($)", key: "total", width: 15 },
    { header: "Time (WIB)", key: "time", width: 25 }
  ];

  Object.values(grouped).forEach(g => {
    const row = sheet.addRow({
      username: g.username,
      items: g.items.join("\n"),
      total: `$${g.total.toLocaleString()}`,
      time: g.time
    });

    row.getCell("total").numFmt = '"$"#,##0';  // <-- ensures $151,000 format
  });

  sheet.getColumn("items").alignment = { wrapText: true, vertical: "top" };

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




/* =========================
   START
========================= */

const PORT = process.env.PORT || 3000;

initDB().then(()=>{
  app.listen(PORT,()=>console.log("Server running on port "+PORT));
});
