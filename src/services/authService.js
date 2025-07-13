import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';
import { cache } from '../config/redis.js';

// Generate OTP
export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Store OTP in Redis with expiration
export const storeOTP = async (mobileNumber, otp, type = 'login') => {
  const key = `otp:${mobileNumber}:${type}`;
  await cache.set(key, otp, 300); // 5 minutes expiration
};

// Verify OTP from Redis
export const verifyOTP = async (mobileNumber, otp, type = 'login') => {
  const key = `otp:${mobileNumber}:${type}`;
  const storedOTP = await cache.get(key);
  
  if (!storedOTP || storedOTP !== otp) {
    return false;
  }
  
  // Delete OTP after successful verification
  await cache.del(key);
  return true;
};

// Hash password
export const hashPassword = async (password) => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

// Compare password
export const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

// Generate JWT token
export const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Create user
export const createUser = async (userData) => {
  const { mobile_number, name, password } = userData;
  const passwordHash = await hashPassword(password);
  
  const result = await query(
    `INSERT INTO users (mobile_number, name, password_hash) 
     VALUES ($1, $2, $3) 
     RETURNING id, mobile_number, name, subscription_tier`,
    [mobile_number, name, passwordHash]
  );
  
  return result.rows[0];
};

// Find user by mobile number
export const findUserByMobile = async (mobileNumber) => {
  const result = await query(
    'SELECT * FROM users WHERE mobile_number = $1',
    [mobileNumber]
  );
  return result.rows[0];
};

// Find user by ID
export const findUserById = async (userId) => {
  const result = await query(
    'SELECT * FROM users WHERE id = $1',
    [userId]
  );
  return result.rows[0];
};

// Update user password
export const updatePassword = async (userId, newPassword) => {
  const passwordHash = await hashPassword(newPassword);
  await query(
    'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [passwordHash, userId]
  );
};

// Send OTP (mocked - returns OTP in response)
export const sendOTP = async (mobileNumber, type = 'login') => {
  const otp = generateOTP();
  await storeOTP(mobileNumber, otp, type);
  
  return {
    success: true,
    message: `OTP sent to ${mobileNumber}`,
    otp: otp, // In production, this would be sent via SMS
    expires_in: 300
  };
};

// Verify OTP and login
export const verifyLoginOTP = async (mobileNumber, otp, password) => {
  // Verify OTP first
  const isValid = await verifyOTP(mobileNumber, otp, 'login');
  if (!isValid) {
    throw new Error('Invalid OTP');
  }

  // Find user
  const user = await findUserByMobile(mobileNumber);
  if (!user) {
    throw new Error('User not found. Please sign up first.');
  }

  // Verify password
  const isValidPassword = await comparePassword(password, user.password_hash);
  if (!isValidPassword) {
    throw new Error('Invalid password');
  }

  const token = generateToken(user.id);
  
  return {
    success: true,
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      mobile_number: user.mobile_number,
      name: user.name,
      subscription_tier: user.subscription_tier
    }
  };
};

// Verify OTP and complete signup
export const verifySignupOTP = async (mobileNumber, otp, name, password) => {
  // Check if user already exists
  const existingUser = await findUserByMobile(mobileNumber);
  if (existingUser) {
    throw new Error('User already exists with this mobile number');
  }

  // Verify OTP
  const isValid = await verifyOTP(mobileNumber, otp, 'signup');
  if (!isValid) {
    throw new Error('Invalid OTP');
  }

  // Create user
  const userData = { mobile_number: mobileNumber, name, password };
  const user = await createUser(userData);
  const token = generateToken(user.id);
  
  return {
    success: true,
    message: 'User created successfully',
    token,
    user: {
      id: user.id,
      mobile_number: user.mobile_number,
      name: user.name,
      subscription_tier: user.subscription_tier
    }
  };
};

// Reset password with OTP
export const resetPassword = async (mobileNumber, otp, newPassword) => {
  // Verify OTP
  const isValid = await verifyOTP(mobileNumber, otp, 'reset');
  if (!isValid) {
    throw new Error('Invalid OTP');
  }

  // Find user
  const user = await findUserByMobile(mobileNumber);
  if (!user) {
    throw new Error('User not found with this mobile number');
  }

  // Update password
  await updatePassword(user.id, newPassword);
  
  return {
    success: true,
    message: 'Password reset successfully'
  };
};

// Change password (for logged-in users)
export const changePassword = async (userId, currentPassword, newPassword) => {
  // Get user with password hash
  const result = await query(
    'SELECT password_hash FROM users WHERE id = $1',
    [userId]
  );
  
  if (result.rows.length === 0) {
    throw new Error('User not found');
  }
  
  const user = result.rows[0];
  
  // Verify current password
  const isValidPassword = await comparePassword(currentPassword, user.password_hash);
  if (!isValidPassword) {
    throw new Error('Current password is incorrect');
  }
  
  // Update password
  await updatePassword(userId, newPassword);
  
  return {
    success: true,
    message: 'Password updated successfully'
  };
};

// Check if user exists and send OTP for signup
export const checkUserAndSendSignupOTP = async (userData) => {
  const { mobile_number, email } = userData;
  
  // Check if mobile number already exists
  const existingUserByMobile = await findUserByMobile(mobile_number);
  if (existingUserByMobile) {
    throw new Error('Mobile number already registered. Please use a different number or login.');
  }

  // Check if email already exists (only if email is provided)
  if (email) {
    const result = await query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    if (result.rows.length > 0) {
      throw new Error('Email already registered. Please use a different email or login.');
    }
  }

  // If user doesn't exist, send OTP automatically
  const otp = generateOTP();
  await storeOTP(mobile_number, otp, 'signup');
  
  return {
    success: true,
    message: `OTP sent to ${mobile_number} for signup verification`,
    otp: otp, // In production, this would be sent via SMS
    expires_in: 300
  };
};

// Complete signup after OTP verification
export const completeSignup = async (userData, otp) => {
  const { mobile_number } = userData;
  
  // Verify OTP
  const isValid = await verifyOTP(mobile_number, otp, 'signup');
  if (!isValid) {
    throw new Error('Invalid OTP');
  }

  // Create user
  const user = await createUser(userData);
  const token = generateToken(user.id);
  
  return {
    success: true,
    message: 'User created successfully',
    token,
    user: {
      id: user.id,
      mobile_number: user.mobile_number,
      name: user.name,
      subscription_tier: user.subscription_tier
    }
  };
}; 