const express = require("express");

const app = express();
app.use(express.json());


app.use((req, res, next) => {
  console.log(`[${process.env.HOSTNAME}] ${req.method} ${req.url}`);
  next();
});

app.get("/stress-cpu", (req, res) => {
  const start = Date.now();
  while (Date.now() - start < 200) {
    Math.sqrt(Math.random());
  }
  res.json({ ok: true });
});


let leak = [];

app.get("/stress-mem", (req, res) => {
  const sizeMb = Number(req.query.mb || 10);
  leak.push(Buffer.alloc(sizeMb * 1024 * 1024));
  res.json({ allocatedMb: sizeMb, totalChunks: leak.length });
});


app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "notification-service",
    instanceId: process.env.HOSTNAME || "unknown",
    timestamp: new Date().toISOString()
  });
});


app.listen(3000, () => {
  console.log("API running on port 3000");
});
