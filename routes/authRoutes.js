const express = require("express")
const { signup, login, getUserDetails, forgotPassword, resetPassword, logout } = require("../controllers/authController")
const authenticateJWT = require("../middleware/authMiddleware")
const router = express.Router()


router.post("/signup", signup)
router.post("/login", login)
router.get("/me",authenticateJWT,getUserDetails)
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);
router.post("/logout", authenticateJWT, logout);


module.exports = router