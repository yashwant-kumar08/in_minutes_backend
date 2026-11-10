const express = require('express');
const mongoose = require('mongoose');
const https = require('https');
require('dotenv').config();

const app = express();

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());

const MONGO_URI = process.env.MONGODB_URI || "mongodb+srv://YashwantKumar-08:Yashwant7070@cluster0.qmw6bf6.mongodb.net/?retryWrites=true&w=majority&authSource=admin";
mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB Atlas successfully!"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

const productSchema = new mongoose.Schema({
  id: Number, name: String, price: Number, category: String, image: String,
  available: { type: Boolean, default: true }, isWeighable: { type: Boolean, default: false }
});
const Product = mongoose.model('Product', productSchema);

// --- INVENTORY ROUTES ---
app.get('/api/products', async (req, res) => {
  try { res.json(await Product.find().sort({ id: -1 })); } 
  catch (err) { res.status(500).json({ error: 'Failed to fetch' }); }
});
app.post('/api/products', async (req, res) => {
  try { res.json(await (new Product(req.body)).save()); } 
  catch (err) { res.status(500).json({ error: 'Failed to add' }); }
});
app.put('/api/products/:id', async (req, res) => {
  try { res.json(await Product.findOneAndUpdate({ id: req.params.id }, req.body, { new: true })); } 
  catch (err) { res.status(500).json({ error: 'Failed to update' }); }
});
app.delete('/api/products/:id', async (req, res) => {
  try { await Product.findOneAndDelete({ id: req.params.id }); res.json({ message: 'Deleted successfully' }); } 
  catch (err) { res.status(500).json({ error: 'Failed to delete' }); }
});

// --- PRODUCTION CASHFREE INTEGRATION ---
app.post('/api/create-payment', (req, res) => {
  const { amount, customerPhone, customerName } = req.body;
  
  // 🔥 HARDCODED TO PRODUCTION FOR STARTUP LAUNCH
  const hostname = "api.cashfree.com"; 

  const postData = JSON.stringify({
    order_amount: amount,
    order_currency: "INR",
    customer_details: {
      customer_id: `cust_${customerPhone || "9999999999"}`,
      customer_phone: customerPhone || "9999999999",
      customer_name: customerName || "Village Customer"
    },
    order_meta: { return_url: "https://inminutes.online/?order_id={order_id}" }
  });

  const options = {
    hostname: hostname,
    port: 443,
    path: '/pg/orders',
    method: 'POST',
    headers: {
      'x-client-id': process.env.CASHFREE_CLIENT_ID,
      'x-client-secret': process.env.CASHFREE_CLIENT_SECRET,
      'x-api-version': '2023-08-01',
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const request = https.request(options, (response) => {
    let data = '';
    response.on('data', (chunk) => { data += chunk; });
    response.on('end', () => {
      try {
        const parsedData = JSON.parse(data);
        if (response.statusCode >= 400) {
          console.error("❌ Cashfree Auth Error:", parsedData);
          return res.status(500).json(parsedData);
        }
        res.json(parsedData);
      } catch (e) { res.status(500).json({ error: 'Failed to parse response' }); }
    });
  });

  request.on('error', (error) => { res.status(500).json({ error: 'Backend failed to connect' }); });
  request.write(postData);
  request.end();
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => { console.log(`🚀 Production Backend running on port ${PORT}`); });