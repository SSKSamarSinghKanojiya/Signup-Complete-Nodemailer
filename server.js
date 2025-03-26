require("dotenv").config();
const express = require("express");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const cors = require("cors");
const bodyParser = require("body-parser");
const redisClient = require("./config/redisClient");

const app = express();

app.use(cors());
app.use(express.json());
app.use(bodyParser.json());
app.use("/api/auth", authRoutes);

connectDB();


// Global Error Handling
app.use((err, req, res, next) => {
  console.error("Global Error:", err.message);
  res.status(500).json({ message: "Internal Server Error" });
});

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Server running on PORT ${PORT}`);
});

