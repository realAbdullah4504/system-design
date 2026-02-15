const express = require("express");
const os = require("os");
const app = express();
app.use(express.json());


app.use((req, res, next) => {
  console.log(`[${process.env.HOSTNAME}] ${req.method} ${req.url}`);
  next();
});

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
