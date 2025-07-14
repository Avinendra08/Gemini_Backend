import express from 'express';
import { 
  sendSignupOTP, 
  verifySignupOTPController, 
  verifyLoginPasswordController,
  sendResetOTP, 
  resetPasswordController, 
  changePasswordController
} from '../controllers/authController.js';
import { validators, validate } from '../utils/validators.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/send-signup-otp', validate(validators.sendOtp), sendSignupOTP);
router.post('/verify-signup-otp', validate(validators.verifySignupOtp), verifySignupOTPController);
router.post('/login', validate(validators.login), verifyLoginPasswordController);


router.post('/forgot-password', validate(validators.forgotPassword), sendResetOTP);

// Protected routes
router.post('/change-password', auth, validate(validators.changePassword), changePasswordController);

export default router; 