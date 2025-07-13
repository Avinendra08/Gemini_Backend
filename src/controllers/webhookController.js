import Stripe from 'stripe';
import { handleWebhook } from '../services/stripeService.js';
import { query } from '../config/database.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Handle Stripe webhook events
export const handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!endpointSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not configured');
    return res.status(500).json({
      success: false,
      message: 'Webhook secret not configured'
    });
  }

  if (!sig) {
    console.error('No Stripe signature found in request');
    return res.status(400).json({
      success: false,
      message: 'No Stripe signature found'
    });
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', {
      error: err.message,
      signature: sig.substring(0, 20) + '...' // Log part of signature safely
    });
    return res.status(400).json({
      success: false,
      message: 'Webhook signature verification failed'
    });
  }

  try {
    // Log the incoming event
    console.log('Received webhook event:', {
      type: event.type,
      id: event.id,
      object: event.data.object.id,
      timestamp: new Date().toISOString()
    });

    // Handle the event
    await handleWebhook(event);
    
    // Verify subscription status after processing
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = parseInt(session.metadata.user_id);
      
      // Double check user subscription status
      const userResult = await query(
        'SELECT subscription_tier, stripe_subscription_id FROM users WHERE id = $1',
        [userId]
      );
      
      if (!userResult.rows[0] || userResult.rows[0].subscription_tier !== 'pro') {
        console.error('Subscription not properly activated for user:', {
          userId,
          session_id: session.id,
          subscription_id: session.subscription,
          current_tier: userResult.rows[0]?.subscription_tier
        });

        // Force update to pro if payment was successful
        if (session.payment_status === 'paid') {
          const updateResult = await query(
            'UPDATE users SET subscription_tier = $1, stripe_subscription_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING id, subscription_tier',
            ['pro', session.subscription, userId]
          );
          console.log('Forced subscription activation:', {
            userId,
            result: updateResult.rows[0]
          });
        }
      }
    }
    
    
    res.status(200).json({
      success: true,
      message: 'Webhook processed successfully'
    });
  } catch (error) {
    console.error('Error processing webhook:', {
      type: event.type,
      id: event.id,
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      message: 'Error processing webhook'
    });
  }
};

// Test webhook endpoint
export const testWebhook = async (req, res) => {
  try {
    // Check if we can connect to Stripe
    const testEvent = await stripe.events.list({ limit: 1 });
    
    // Check if webhook secret is configured
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    res.status(200).json({
      success: true,
      message: 'Webhook endpoint is working',
      stripe_connected: !!testEvent,
      webhook_secret_configured: !!webhookSecret,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Webhook test failed:', error);
    res.status(500).json({
      success: false,
      message: 'Webhook test failed',
      error: error.message
    });
  }
};