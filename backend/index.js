const express = require("express");

const app = express();
app.use(express.json());


app.use((req, res, next) => {
  console.log(`[${process.env.HOSTNAME}] ${req.method} ${req.url}`);
  next();
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
