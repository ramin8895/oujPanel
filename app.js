const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("🚀 Smart DM Bot Backend is Running");
});

app.use("/auth", require("./routes/authRoutes"));
app.use("/webhook", require("./routes/webhookRoutes"));
app.use("/instagram", require("./routes/instagramRoutes"));

module.exports = app;
