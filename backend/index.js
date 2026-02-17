const express = require("express");
const os = require("os");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
app.use(express.json());

// ======= MongoDB Atlas Connection =======
const mongoURI = process.env.MONGO_URI; // e.g., mongodb+srv://user:pass@cluster.mongodb.net/dbName
const mongoOptions = {
  maxPoolSize: 50,           // max concurrent connections
  minPoolSize: 10,           // minimum connections kept alive
  retryWrites: true,         // retry transient write errors
  w: "majority",             // write concern: confirmed by majority of nodes
  readPreference: "primaryPreferred", // reads prefer primary, fallback to secondary
  serverSelectionTimeoutMS: 5000,     // fail fast if no node available
};

// Connect to MongoDB
mongoose.connect(mongoURI, mongoOptions);

const db = mongoose.connection;
db.on("connected", () => console.log("MongoDB connected ✅"));
db.on("error", (err) => console.error("MongoDB connection error ❌", err));
db.on("disconnected", () => console.warn("MongoDB disconnected ⚠️"));
db.on("reconnected", () => console.log("MongoDB reconnected 🔄"));

// Optional: log topology info for replica set
db.on("open", async () => {
  const admin = new mongoose.mongo.Admin(db.db);
  const info = await admin.replSetGetStatus().catch(() => null);
  if (info) {
    console.log("Replica Set Name:", info.set);
    console.log("Members:", info.members.map(m => m.name));
  }
});

// ======= Middleware =======
app.use((req, res, next) => {
  console.log(`[${process.env.HOSTNAME || os.hostname()}] ${req.method} ${req.url}`);
  next();
});

// ======= Routes =======

// CPU-bound task (blocks event loop)
app.get("/stress-cpu", (req, res) => {
  const start = Date.now();
  while (Date.now() - start < 200) {
    Math.sqrt(Math.random());
  }
  res.json({ 
    ok: true, 
    type: "CPU-bound",
    server: os.hostname(),
  });
});

// Async "I/O-bound" simulation (does NOT block event loop)
app.get("/async-wait", async (req, res) => {
  await new Promise((resolve) => setTimeout(resolve, 200));
  res.json({ 
    ok: true, 
    type: "Async I/O-bound",
  });
});

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "notification-service",
    instanceId: process.env.HOSTNAME || os.hostname(),
    timestamp: new Date().toISOString()
  });
});

// ======= Start Server =======
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});
