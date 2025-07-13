import express from 'express';
import { 
  createCheckoutSessionController, 
  getSubscriptionStatusController, 
  cancelSubscription, 
  reactivateSubscription, 
  getPlans 
} from '../controllers/subscriptionController.js';
import { validators, validate } from '../utils/validators.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(auth);

// Subscription routes
router.post('/pro', validate(validators.createSubscription), createCheckoutSessionController);
router.get('/status', getSubscriptionStatusController);
router.post('/cancel', cancelSubscription);
router.post('/reactivate', reactivateSubscription);
router.get('/plans', getPlans);

export default router; 