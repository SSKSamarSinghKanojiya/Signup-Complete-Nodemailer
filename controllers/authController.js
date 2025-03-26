const bcrypt = require("bcryptjs"); // Import bcrypt for password hashing
const jwt = require("jsonwebtoken"); // Import JWT for token-based authentication
const User = require("../models/User"); // Import User model for database operations
const nodemailer = require("nodemailer"); // Import nodemailer for sending emails
const crypto = require("crypto"); // Import crypto for generating secure tokens
const redisClient = require("../config/redisClient");

// User Signup Function
exports.signup = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body; // Extract user input from request body

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: "Email already in use" });
    }

    // Hash the password before storing it
    const salt = await bcrypt.genSalt(10); // Generate a salt for hashing
    const hashedPassword = await bcrypt.hash(password, salt); // Hash the password

    // Create a new user instance
    user = new User({ firstName, lastName, email, password: hashedPassword });

    // Save user to the database
    await user.save();

    // Send email confirmation using Nodemailer
    const transporter = nodemailer.createTransport({
      service: "gmail", // Use Gmail as the email service
      secure: true, // Use SSL for secure connection
      port: 465, // Port number for SSL
      auth: {
        user: process.env.EMAIL_USER, // Email credentials from environment variables
        pass: process.env.EMAIL_PASS,
      },
    });

    // Define email content
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "Registration Successful",
      text: `Hello ${firstName}, your Registration Successful. Your email is ${email} and password is => ${password}`,
    };

    // Send the email
    transporter.sendMail(mailOptions);

    res.status(201).json({ message: "User registered successfully" }); // Send success response
  } catch (error) {
    res.status(400).json({ message: error.message }); // Handle errors
  }
};

// User Login Function
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body; // Extract email and password from request body

    // Check if the user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Compare the provided password with the hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Generate a JWT token for authentication
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES, // Token expiration time from environment variables
    });

    res.status(200).json({ message: "Login successfully", token: token }); // Send success response with token
  } catch (error) {
    res.status(400).json({ message: error.message }); // Handle errors
  }
};

// User Logout Function
// exports.logout = async (req, res) => {
//   try {
//     const token = req.headers.authorization?.split(" ")[1]; // Extract token from the Authorization header

//     if (!token) {
//       return res.status(401).json({ message: "Unauthorized: No token provided" }); // Return error if no token is found
//     }

//     // Get token expiration time
//     const decoded = jwt.decode(token); // Decode the token without verifying it to extract expiration time
//     const expiresIn = decoded.exp - Math.floor(Date.now() / 1000); // Calculate remaining time until expiration

//     // Store token in Redis with expiration time to prevent reuse
//     await redisClient.setEx(`blacklist_${token}`, expiresIn, "blacklisted");

//     res.json({ message: "Logged out successfully" }); // Send success response
//   } catch (error) {
//     console.error("Logout error:", error); // Log errors for debugging
//     res.status(500).json({ message: "Server error" }); // Send error response if something goes wrong
//   }
// };

exports.logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1]; // Extract token

    if (!token) {
      return res.status(401).json({ message: "Unauthorized: No token provided" });
    }
    // Get token expiry time from JWT
    const decoded = jwt.decode(token);
    const expiresIn = decoded.exp - Math.floor(Date.now() / 1000); // Remaining expiry time in seconds

    // Blacklist the token in Redis (without decoding)
    // await redisClient.setEx(`blacklist_${token}`, expiresIn, "blacklisted"); // Expires in 1 hour (adjust as needed)
    if (expiresIn > 0) {
      await redisClient.setEx(`blacklist:${token}`, expiresIn, "blacklisted");
    }

    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Fetch User Details
exports.getUserDetails = async (req, res) => {
  try {
    // Find user based on authenticated user's ID
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user); // Return user details
  } catch (error) {
    res.status(500).json({ message: error.message }); // Handle errors
  }
};

// Forgot Password Function
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body; // Extract email from request body

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });

    // Generate a random token for password reset
    const resetToken = crypto.randomBytes(20).toString("hex");
    user.resetToken = resetToken;
    user.resetTokenExpires = Date.now() + 300000; // Token expires in 5 minutes

    // Save the reset token in the database
    await user.save();

    // Configure email transporter for sending reset password link
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });

    // Create the reset password URL
    const resetUrl = `http://localhost:3000/api/auth/reset-password/${resetToken}`;

    // Send reset password email
    await transporter.sendMail({
      to: user.email,
      subject: "Reset Password",
      text: `Click here to reset your password: ${resetUrl}`,
    });

    res.json({ message: "Reset link sent successfully" }); // Send success response
  } catch (error) {
    console.error("Error in forgotPassword:", error); // Log error for debugging
    res.status(500).json({ message: error.message }); // Handle errors
  }
};

// Reset Password Function
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params; // Extract token from request parameters
    const { password } = req.body; // Extract new password from request body

    // Find user with valid reset token and check expiration time
    const user = await User.findOne({
      resetToken: token,
      resetTokenExpires: { $gt: Date.now() }, // Ensure token is still valid
    });

    if (!user)
      return res.status(400).json({ message: "Invalid or expired token" });

    // Hash the new password before saving it
    user.password = await bcrypt.hash(password, 10);
    user.resetToken = undefined; // Remove reset token after use
    user.resetTokenExpires = undefined;

    // Save updated user details
    await user.save();

    // Send confirmation email after password reset
    const transporter = nodemailer.createTransport({
      service: "gmail",
      secure: true,
      port: 465,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "Updated Password Successful",
      text: `Hello ${user.firstName}, your email is ${user.email} and updated password is => ${password}`,
    };

    transporter.sendMail(mailOptions); // Send email notification

    res.json({ message: "Password reset successful" }); // Send success response
  } catch (error) {
    console.error("Error in resetPassword:", error); // Log error for debugging
    res.status(500).json({ message: error.message }); // Handle errors
  }
};

// const bcrypt = require("bcryptjs");
// const jwt = require("jsonwebtoken");
// const User = require("../models/User");
// const nodemailer = require("nodemailer");
// const crypto = require("crypto");

// exports.signup = async (req, res) => {
//   try {
//     const { firstName, lastName, email, password } = req.body;
//     let user = await User.findOne({ email });
//     if (user) {
//       return res.status(400).json({ message: "Email already in use" });
//     }
//     const salt = await bcrypt.genSalt(10);
//     const hashedPassword = await bcrypt.hash(password, salt);
//     user = new User({ firstName, lastName, email, password: hashedPassword });
//     await user.save();

//      // Send email with Nodemailer
//      const transporter = nodemailer.createTransport({
//       service: "gmail",
//       secure:true,
//       port :465,
//       auth: {
//         user: process.env.EMAIL_USER,
//         pass: process.env.EMAIL_PASS,
//       },
//     });
//     const mailOptions = {
//       from: process.env.EMAIL_USER,
//       to: user.email,
//       subject: "Registration Successful",
//       text: `Hello ${firstName}, your Registration Successful your email is ${email} and password is => ${password}`,
//     };
//     transporter.sendMail(mailOptions);
//     res.status(201).json({ message: "User registered successfully" });
//   } catch (error) {
//     res.status(400).json({ message: error.message });
//   }
// };

// exports.login = async (req, res) => {
//   try {
//     const { email, password } = req.body;
//     const user = await User.findOne({ email });
//     if (!user) {
//       return res.status(400).json({ message: "Invalid credentials" });
//     }
//     const isMatch = await bcrypt.compare(password, user.password);
//     if (!isMatch) {
//       return res.status(400).json({ message: "Invalid credentials" });
//     }
//     const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
//       expiresIn: process.env.JWT_EXPIRES,
//     });
//     res.status(200).json({ message: "Login successfully", token: token });
//   } catch (error) {
//     res.status(400).json({ message: error.message });
//   }
// };

// exports.getUserDetails = async(req,res) =>{
//   try {
//     const user = await User.findById(req.user.userId)
//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }
//     res.json(user);
//   } catch (error) {
//     res.status(500).json({message:error.message})
//   }
// }

// exports.forgotPassword = async (req, res) => {
//   try {
//     const { email } = req.body;
//     const user = await User.findOne({ email });
//     if (!user) return res.status(400).json({ message: "User not found" });

//     const resetToken = crypto.randomBytes(20).toString("hex");
//     user.resetToken = resetToken;
//     user.resetTokenExpires = Date.now() + 300000; // 5 minutes

//     await user.save();

//     const transporter = nodemailer.createTransport({
//       service: "Gmail",
//       // secure:true,
//       // port :465,
//       auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
//     });

//     const resetUrl = `http://localhost:3000/api/auth/reset-password/${resetToken}`;
//     await transporter.sendMail({
//       to: user.email,
//       subject: "Reset Password",
//       text: `Click here to reset your password: ${resetUrl}`,
//     });

//     res.json({ message: "Reset link sent to successfully" });
//   } catch (error) {
//     console.error("Error in forgotPassword:", error); // Debugging
//     res.status(500).json({ message: error.message });
//   }
// };

// exports.resetPassword = async (req, res) => {
//   try {
//     const { token } = req.params;
//     const { password } = req.body;

//     const user = await User.findOne({ resetToken: token, resetTokenExpires: { $gt: Date.now() } });
//     if (!user) return res.status(400).json({ message: "Invalid or expired token" });

//     user.password = await bcrypt.hash(password, 10);
//     user.resetToken = undefined;
//     user.resetTokenExpires = undefined;

//     await user.save();
//      // Send email with Nodemailer
//      const transporter = nodemailer.createTransport({
//       service: "gmail",
//       secure:true,
//       port :465,
//       auth: {
//         user: process.env.EMAIL_USER,
//         pass: process.env.EMAIL_PASS,
//       },
//     });
//     const mailOptions = {
//       from: process.env.EMAIL_USER,
//       to: user.email,
//       subject: "Updated Password Successful",
//       text: `Hello ${firstName}, your email is ${email} and updated password is => ${password}`,
//     };
//     transporter.sendMail(mailOptions);
//     res.json({ message: "Password reset successful" });
//   } catch (error) {
//     console.error("Error in forgotPassword:", error); // Debugging
//     res.status(500).json({ message: error.message });
//   }
// };
