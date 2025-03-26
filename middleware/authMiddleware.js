
const jwt = require("jsonwebtoken");
const redisClient = require("../config/redisClient");
// require("dotenv").config();

const authenticateJWT = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1]; // Extract token

  if (!token) {
    return res.status(403).json({ message: "Access denied. No token provided." });
  }

  try {
    // Check if the token is blacklisted in Redis
    const isBlacklisted = await redisClient.get(`blacklist_${token}`);
    if (isBlacklisted) {
      return res.status(403).json({ message: "Token is blacklisted. Please log in again." });
    }

    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Attach user info to request

    next(); // Proceed to next middleware/route
  } catch (error) {
    console.log(error);
    
    res.status(401).json({ message: error.message });
  }
};

module.exports = authenticateJWT;
