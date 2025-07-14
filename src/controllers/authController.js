import { 
  sendOTP, 
  verifyLoginPassword, 
  resetPassword, 
  changePassword,
  checkUserAndSendSignupOTP,
  completeSignup
} from '../services/authService.js';

// Send OTP for signup (only if user doesn't exist)
export const sendSignupOTP = async (req, res) => {
  try {
    const { mobile_number } = req.body;
    
    // Check if user exists and send OTP only if they don't exist
    const result = await checkUserAndSendSignupOTP({ mobile_number, email: null });
    
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};


// Verify OTP and complete signup
export const verifySignupOTPController = async (req, res) => {
  try {
    const { mobile_number, otp, name, password } = req.body;
    
    const result = await completeSignup({ mobile_number, name, password }, otp);
    
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Verify login
export const verifyLoginPasswordController = async (req, res) => {
  try {
    const { mobile_number, password } = req.body;

    const result = await verifyLoginPassword(mobile_number,password); 

    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Send OTP for password reset
export const sendResetOTP = async (req, res) => {
  try {
    const { mobile_number } = req.body;
    
    const result = await sendOTP(mobile_number, 'reset');
    
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Verify OTP and reset password
export const resetPasswordController = async (req, res) => {
  try {
    const { mobile_number, otp, new_password } = req.body;
    
    const result = await resetPassword(mobile_number, otp, new_password);
    
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Change password (for logged-in users)
export const changePasswordController = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const userId = req.user.id;
    
    const result = await changePassword(userId, current_password, new_password);
    
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}; 