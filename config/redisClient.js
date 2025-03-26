// const redis = require("redis");

// const redisClient = redis.createClient({
//   host: "127.0.0.1",
//   port: 6379, // Default Redis port
//   // port: 3000, // Default Redis port
// });

// redisClient.on("error", (err) => {
//   console.error("Redis error:", err);
// });

// redisClient.connect();

// module.exports = redisClient;


// const redis = require("redis");
// const redisClient = redis.createClient({
//   host: "127.0.0.1",
//   port: 6379,
//   socket: {
//     reconnectStrategy: 3, // Try reconnecting 3 times before failing
//   },
// });

// redisClient.on("error", (err) => console.error("Redis error:", err));
// // process.exit(1);
// redisClient.connect();

// module.exports = redisClient;


const { createClient } = require("redis");

const redisClient = createClient({
  // url: "redis://localhost:6379", // Default Redis URL
  url: "redis://default:secret@localhost:6379", // Default Redis URL
});

redisClient.on("error", (err) => console.error("Redis Error:", err));

(async () => {
  try {
    await redisClient.connect();
    // await redisClient.auth("yourpassword"); // Manually authenticate
    console.log("✅ Redis connected successfully!");
  } catch (err) {
    console.error("❌ Redis connection error:", err);
  }
})();

module.exports = redisClient;
