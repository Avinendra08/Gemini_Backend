import { createCheckoutSession, getSubscriptionStatus } from '../services/stripeService.js';
import { query } from '../config/database.js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Create Stripe checkout session for Pro subscription
export const createCheckoutSessionController = async (req, res) => {
  try {
    const userId = req.user.id;
    const { success_url, cancel_url } = req.body;
    
    const session = await createCheckoutSession(userId, success_url, cancel_url);
    
    res.status(200).json({
      success: true,
      message: 'Checkout session created successfully',
      session_id: session.id,
      checkout_url: session.url
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get subscription status
export const getSubscriptionStatusController = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const status = await getSubscriptionStatus(userId);
    
    res.status(200).json({
      success: true,
      subscription: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Cancel subscription
export const cancelSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user's subscription ID
    const result = await query(
      'SELECT stripe_subscription_id FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length === 0 || !result.rows[0].stripe_subscription_id) {
      return res.status(404).json({
        success: false,
        message: 'No active subscription found'
      });
    }
    
    const subscriptionId = result.rows[0].stripe_subscription_id;
    
    // Cancel subscription in Stripe
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true
    });
    
    res.status(200).json({
      success: true,
      message: 'Subscription will be cancelled at the end of the current period',
      subscription: {
        id: subscription.id,
        status: subscription.status,
        cancel_at_period_end: subscription.cancel_at_period_end,
        current_period_end: new Date(subscription.current_period_end * 1000)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Reactivate subscription
export const reactivateSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user's subscription ID
    const result = await query(
      'SELECT stripe_subscription_id FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length === 0 || !result.rows[0].stripe_subscription_id) {
      return res.status(404).json({
        success: false,
        message: 'No subscription found'
      });
    }
    
    const subscriptionId = result.rows[0].stripe_subscription_id;
    
    // Reactivate subscription in Stripe
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false
    });
    
    res.status(200).json({
      success: true,
      message: 'Subscription reactivated successfully',
      subscription: {
        id: subscription.id,
        status: subscription.status,
        cancel_at_period_end: subscription.cancel_at_period_end,
        current_period_end: new Date(subscription.current_period_end * 1000)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get subscription plans
export const getPlans = async (req, res) => {
  try {
    const plans = [
      {
        id: 'basic',
        name: 'Basic',
        price: 0,
        currency: 'USD',
        features: [
          '5 messages per day',
          'Basic AI responses',
          'Standard support'
        ],
        limits: {
          daily_messages: parseInt(process.env.BASIC_DAILY_MESSAGE_LIMIT) || 5
        }
      },
      {
        id: 'pro',
        name: 'Pro',
        price: 9.99,
        currency: 'USD',
        features: [
          'Unlimited messages',
          'Advanced AI responses',
          'Priority support',
          'Conversation history',
          'Custom chatrooms'
        ],
        limits: {
          daily_messages: parseInt(process.env.PRO_DAILY_MESSAGE_LIMIT) || 1000
        }
      }
    ];
    
    res.status(200).json({
      success: true,
      plans
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}; 