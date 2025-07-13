import express from 'express';
import { handleStripeWebhook, testWebhook } from '../controllers/webhookController.js';

const router = express.Router();

// Webhook routes (no authentication required)
router.post('/stripe', handleStripeWebhook);
router.get('/test', testWebhook);

export default router;