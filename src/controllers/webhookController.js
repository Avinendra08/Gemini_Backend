import Stripe from 'stripe';
import { handleWebhook } from '../services/stripeService.js';
import { query } from '../config/database.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Handle Stripe webhook events
export const handleStripeWebhook = async (req, res) => {
  try {
    // Log request details
    console.log('Webhook Request Details:', {
      headers: {
        'stripe-signature': req.headers['stripe-signature']?.substring(0, 20) + '...',
        'content-type': req.headers['content-type'],
        'content-length': req.headers['content-length']
      },
      bodyType: typeof req.body,
      bodyIsBuffer: Buffer.isBuffer(req.body),
      rawBody: req.body?.toString()?.substring(0, 50) + '...' // Log first 50 chars safely
    });

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

    // Log the secret we're using (first few chars only)
    console.log('Using webhook secret:', endpointSecret.substring(0, 8) + '...');

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', {
        error: err.message,
        signature: sig.substring(0, 20) + '...', // Log part of signature safely
        bodyLength: req.body?.length,
        bodyPreview: Buffer.isBuffer(req.body) ? 
          req.body.toString('utf8').substring(0, 50) + '...' : 
          'Body is not a buffer'
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
      
      console.log(`Webhook event processed successfully: ${event.type}`);
      
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

  } catch (error) {
    console.error('Unexpected error in webhook handler:', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      message: 'Internal server error processing webhook'
    });
  }
};

// Test webhook endpoint with detailed verification
export const testWebhook = async (req, res) => {
  try {
    // Check if we can connect to Stripe
    const testEvent = await stripe.events.list({ limit: 1 });
    
    // Check webhook configuration
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    
    // Test creating a simple event construction
    const testPayload = JSON.stringify({test: 'data'});
    const testSignature = 'test_signature';
    
    try {
      stripe.webhooks.constructEvent(testPayload, testSignature, 'test_secret');
    } catch (err) {
      // This should fail, we just want to verify the method works
      console.log('Expected webhook test failure (this is normal)');
    }
    
    res.status(200).json({
      success: true,
      message: 'Webhook endpoint is working',
      configuration: {
        stripe_connected: !!testEvent,
        webhook_secret_configured: !!webhookSecret,
        stripe_key_configured: !!stripeKey,
        stripe_key_starts_with: stripeKey ? stripeKey.substring(0, 7) : null
      },
      request_handling: {
        raw_body_parser_enabled: req.headers['content-type'] !== 'application/json' || !req.body,
        current_content_type: req.headers['content-type']
      },
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