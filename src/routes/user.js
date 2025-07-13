import express from 'express';
import { getProfile, updateProfile, getStats } from '../controllers/userController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(auth);

// Get user profile
router.get('/me', getProfile);

// Update user profile
router.put('/me', updateProfile);

// Get user statistics
router.get('/stats', getStats);

export default router; 