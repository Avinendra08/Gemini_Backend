import express from 'express';
import { 
  sendSignupOTP, 
  sendLoginOTP, 
  verifySignupOTPController, 
  verifyLoginOTPController, 
  sendResetOTP, 
  resetPasswordController, 
  changePasswordController 
} from '../controllers/authController.js';
import { validators, validate } from '../utils/validators.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/send-otp', validate(validators.sendOtp), sendLoginOTP);
router.post('/send-signup-otp', validate(validators.sendOtp), sendSignupOTP);
router.post('/verify-otp', validate(validators.verifyOtp), verifyLoginOTPController);
router.post('/verify-signup-otp', validate(validators.verifySignupOtp), verifySignupOTPController);
router.post('/signup', validate(validators.signup), verifySignupOTPController);
router.post('/forgot-password', validate(validators.forgotPassword), sendResetOTP);

// Protected routes
router.post('/change-password', auth, validate(validators.changePassword), changePasswordController);

export default router; 