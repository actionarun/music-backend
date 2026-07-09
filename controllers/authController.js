const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const sendEmail = require("../utils/sendEmail");

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

//  Register new user + send verification email
const signup = async (req, res) => {
  try {
    const { name, email, password, genres } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Please provide name, email and password" });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists with this email" });
    }

    const user = await User.create({
      name,
      email,
      password,
      preferences: { genres: genres || [] },
    });

    // generate verification token
    const rawToken = crypto.randomBytes(32).toString("hex");
    user.verificationToken = hashToken(rawToken);
    user.verificationTokenExpire = Date.now() + 24 * 60 * 60 * 1000; // 24 hrs
    await user.save({ validateBeforeSave: false });

    const verifyUrl = `${process.env.CLIENT_URL}/verify-email/${rawToken}`;

    try {
      await sendEmail({
        to: user.email,
        subject: "Verify your Music App account",
        html: `<p>Hi ${user.name},</p>
               <p>Click below to verify your account:</p>
               <a href="${verifyUrl}">${verifyUrl}</a>
               <p>This link expires in 24 hours.</p>`,
      });
    } catch (mailErr) {
      console.error("Email send failed:", mailErr.message);
    }

    res.status(201).json({
      message: "Signup successful. Please check your email to verify your account.",
      _id: user._id,
      name: user.name,
      email: user.email,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//  Verify email via token
const verifyEmail = async (req, res) => {
  try {
    const hashed = hashToken(req.params.token);

    const user = await User.findOne({
      verificationToken: hashed,
      verificationTokenExpire: { $gt: Date.now() },
    }).select("+verificationToken +verificationTokenExpire");

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired verification link" });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpire = undefined;
    await user.save({ validateBeforeSave: false });

    res.json({ message: "Email verified successfully. You can now log in." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//   Login user
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Please provide email and password" });
    }

    const user = await User.findOne({ email }).select("+password");

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!user.isVerified) {
      return res.status(403).json({ message: "Please verify your email before logging in" });
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      preferences: user.preferences,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Forgot password - send reset link
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "No account found with this email" });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = hashToken(rawToken);
    user.resetPasswordExpire = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${rawToken}`;

    await sendEmail({
      to: user.email,
      subject: "Reset your Music App password",
      html: `<p>Hi ${user.name},</p>
             <p>Click below to reset your password (valid for 1 hour):</p>
             <a href="${resetUrl}">${resetUrl}</a>`,
    });

    res.json({ message: "Password reset link sent to your email" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//  Reset password
const resetPassword = async (req, res) => {
  try {
    const { password } = req.body;
    const hashed = hashToken(req.params.token);

    const user = await User.findOne({
      resetPasswordToken: hashed,
      resetPasswordExpire: { $gt: Date.now() },
    }).select("+resetPasswordToken +resetPasswordExpire");

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset link" });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.json({ message: "Password reset successful. You can now log in." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate("likedSongs", "title artist album coverImage")
      .populate("playlists", "name coverImage");
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.name = req.body.name || user.name;
    user.avatar = req.body.avatar || user.avatar;
    if (req.body.genres) user.preferences.genres = req.body.genres;
    if (req.body.password) user.password = req.body.password;

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      preferences: updatedUser.preferences,
      avatar: updatedUser.avatar,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  signup,
  verifyEmail,
  login,
  forgotPassword,
  resetPassword,
  getProfile,
  updateProfile,
};