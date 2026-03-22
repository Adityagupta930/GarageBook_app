const express = require('express');
const cors    = require('cors');
const db      = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// ── INVENTORY ────────────────────────────────────────────────────

// GET all inventory
app.get('/api/inventory', (req, res) => {
  res.json(db.prepare('SELECT * FROM inventory ORDER BY name').all());
});

// POST add item
app.post('/api/inventory', (req, res) => {
  const { name, stock, price } = req.body;
  if (!name || stock == null || price == null)
    return res.status(400).json({ error: 'name, stock, price zaroori hain' });

  const exists = db.prepare('SELECT id FROM inventory WHERE LOWER(name) = LOWER(?)').get(name);
  if (exists) return res.status(409).json({ error: 'Yeh item pehle se hai' });

  const result = db.prepare('INSERT INTO inventory (name, stock, price) VALUES (?, ?, ?)').run(name, stock, price);
  res.status(201).json({ id: result.lastInsertRowid, name, stock, price });
});

// PUT update stock + price
app.put('/api/inventory/:id', (req, res) => {
  const { stock, price } = req.body;
  const { id } = req.params;
  if (stock == null || price == null)
    return res.status(400).json({ error: 'stock aur price zaroori hain' });

  db.prepare('UPDATE inventory SET stock = ?, price = ? WHERE id = ?').run(stock, price, id);
  res.json({ success: true });
});

// DELETE item
app.delete('/api/inventory/:id', (req, res) => {
  db.prepare('DELETE FROM inventory WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── SALES ────────────────────────────────────────────────────────

// GET all sales
app.get('/api/sales', (req, res) => {
  res.json(db.prepare('SELECT * FROM sales ORDER BY date DESC').all());
});

// POST record sale
app.post('/api/sales', (req, res) => {
  const { item_id, item_name, qty, amount, payment, customer, phone } = req.body;
  if (!item_name || !qty || !amount || !payment)
    return res.status(400).json({ error: 'item_name, qty, amount, payment zaroori hain' });
  if (payment === 'udhaar' && !customer)
    return res.status(400).json({ error: 'Udhaar ke liye customer naam zaroori hai' });

  // check + deduct stock
  const item = db.prepare('SELECT * FROM inventory WHERE id = ?').get(item_id);
  if (!item) return res.status(404).json({ error: 'Item nahi mila' });
  if (item.stock < qty) return res.status(400).json({ error: `Sirf ${item.stock} stock bacha hai` });

  db.prepare('UPDATE inventory SET stock = stock - ? WHERE id = ?').run(qty, item_id);

  const result = db.prepare(
    `INSERT INTO sales (item_id, item_name, qty, amount, payment, customer, phone, udhaar_paid)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(item_id, item_name, qty, amount, payment, customer || 'Walk-in', phone || '', payment !== 'udhaar' ? 1 : 0);

  res.status(201).json({ id: result.lastInsertRowid });
});

// PUT mark udhaar paid
app.put('/api/sales/:id/paid', (req, res) => {
  db.prepare('UPDATE sales SET udhaar_paid = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── START ────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ GarageBook backend chal raha hai → http://localhost:${PORT}`));
