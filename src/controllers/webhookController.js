import Stripe from 'stripe';
import { query } from '../config/database.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Create Stripe customer
export const createCustomer = async (userId, email, name) => {
  try {
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        user_id: userId.toString()
      },
      // Add shipping address for Indian export compliance
      shipping: {
        name: name,
        address: {
          country: 'IN' // Default to India, will be updated during checkout
        }
      }
    });

    // Update user with Stripe customer ID
    await query(
      'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
      [customer.id, userId]
    );

    return customer;
  } catch (error) {
    console.error('Error creating Stripe customer:', error);
    throw new Error('Failed to create customer');
  }
};

// Create checkout session for Pro subscription
export const createCheckoutSession = async (userId, successUrl, cancelUrl) => {
  try {
    console.log('Creating checkout session for user:', userId);
    
    // Get user details
    const userResult = await query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = userResult.rows[0];
    console.log('Found user:', { id: user.id, hasStripeCustomer: !!user.stripe_customer_id });

    // Create or get Stripe customer
    let customer;
    if (user.stripe_customer_id) {
      console.log('Retrieving existing Stripe customer:', user.stripe_customer_id);
      customer = await stripe.customers.retrieve(user.stripe_customer_id);
    } else {
      console.log('Creating new Stripe customer for user:', user.id);
      customer = await createCustomer(userId, user.email, user.name);
    }

    console.log('Creating Stripe checkout session with params:', {
      customerId: customer.id,
      priceId: process.env.STRIPE_PRICE_ID,
      userId: userId
    });

    // Create checkout session with Indian export compliance
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        user_id: userId.toString()
      },
      // Add customer information for Indian export compliance
      customer_update: {
        address: 'auto',
        name: 'auto'
      },
      billing_address_collection: 'required',
      // Add tax collection for Indian compliance
      tax_id_collection: {
        enabled: true
      }
    });

    console.log('Checkout session created successfully:', {
      sessionId: session.id,
      userId: userId,
      customerId: customer.id
    });

    return session;
  } catch (error) {
    console.error('Error creating checkout session:', {
      userId,
      error: error.message,
      stack: error.stack
    });
    throw new Error('Failed to create checkout session');
  }
};

// Handle webhook events
export const handleWebhook = async (event) => {
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error('Error handling webhook:', error);
    throw error;
  }
};

// Handle checkout session completed
const handleCheckoutCompleted = async (session) => {
  try {
    console.log('Processing completed checkout session:', {
      sessionId: session.id,
      subscription: session.subscription,
      customerId: session.customer,
      metadata: session.metadata
    });

    const userId = parseInt(session.metadata.user_id);
    
    // Verify the subscription exists in Stripe
    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    console.log('Retrieved subscription from Stripe:', {
      status: subscription.status,
      customerId: subscription.customer,
      subscriptionId: subscription.id
    });
    
    // Update user subscription status
    await query(
      `UPDATE users 
       SET subscription_tier = 'pro', 
           stripe_subscription_id = $1,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2
       RETURNING id, subscription_tier, stripe_subscription_id`,
      [session.subscription, userId]
    ).then(result => {
      console.log('Updated user subscription:', {
        userId,
        updatedRows: result.rows,
        newSubscriptionId: session.subscription
      });
    });

    // Verify subscription record exists
    const subscriptionRecord = await query(
      'SELECT * FROM subscriptions WHERE stripe_subscription_id = $1',
      [session.subscription]
    );

    if (subscriptionRecord.rows.length === 0) {
      console.log('Creating missing subscription record');
      // Create subscription record if it doesn't exist
      await handleSubscriptionCreated(subscription);
    }

    console.log(`User ${userId} subscription activated successfully`);
  } catch (error) {
    console.error('Error in handleCheckoutCompleted:', {
      sessionId: session.id,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};

// Handle subscription created
const handleSubscriptionCreated = async (subscription) => {
  try {
    console.log('Processing new subscription:', {
      subscriptionId: subscription.id,
      customerId: subscription.customer,
      status: subscription.status
    });

    const customer = await stripe.customers.retrieve(subscription.customer);
    const userId = parseInt(customer.metadata.user_id);

    console.log('Retrieved customer details:', {
      customerId: customer.id,
      userId: userId
    });

    // Insert subscription record
    const result = await query(
      `INSERT INTO subscriptions 
       (user_id, stripe_subscription_id, stripe_customer_id, status, 
        current_period_start, current_period_end) 
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        userId,
        subscription.id,
        subscription.customer,
        subscription.status,
        new Date(subscription.current_period_start * 1000),
        new Date(subscription.current_period_end * 1000)
      ]
    );

    console.log('Subscription record created:', {
      subscriptionRecord: result.rows[0],
      userId: userId
    });
  } catch (error) {
    console.error('Error in handleSubscriptionCreated:', {
      subscriptionId: subscription.id,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};

// Handle subscription updated
const handleSubscriptionUpdated = async (subscription) => {
  await query(
    `UPDATE subscriptions 
     SET status = $1, 
         current_period_start = $2, 
         current_period_end = $3,
         updated_at = CURRENT_TIMESTAMP 
     WHERE stripe_subscription_id = $4`,
    [
      subscription.status,
      new Date(subscription.current_period_start * 1000),
      new Date(subscription.current_period_end * 1000),
      subscription.id
    ]
  );

  // Update user tier if subscription is cancelled
  if (subscription.status === 'canceled') {
    await query(
      `UPDATE users 
       SET subscription_tier = 'basic', 
           updated_at = CURRENT_TIMESTAMP 
       WHERE stripe_subscription_id = $1`,
      [subscription.id]
    );
  }
};

// Handle subscription deleted
const handleSubscriptionDeleted = async (subscription) => {
  await query(
    `UPDATE subscriptions 
     SET status = 'canceled', 
         updated_at = CURRENT_TIMESTAMP 
     WHERE stripe_subscription_id = $1`,
    [subscription.id]
  );

  // Update user tier
  await query(
    `UPDATE users 
     SET subscription_tier = 'basic', 
         updated_at = CURRENT_TIMESTAMP 
     WHERE stripe_subscription_id = $1`,
    [subscription.id]
  );
};

// Handle payment succeeded
const handlePaymentSucceeded = async (invoice) => {
  console.log(`Payment succeeded for invoice ${invoice.id}`);
};

// Handle payment failed
const handlePaymentFailed = async (invoice) => {
  console.log(`Payment failed for invoice ${invoice.id}`);
};

// Get subscription status
export const getSubscriptionStatus = async (userId) => {
  const result = await query(
    `SELECT u.subscription_tier, u.stripe_subscription_id, u.stripe_customer_id,
            s.status as sub_status, s.current_period_end
     FROM users u
     LEFT JOIN subscriptions s ON s.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    throw new Error('User not found');
  }

  const user = result.rows[0];
  
  // If user has a subscription ID, verify with Stripe
  if (user.stripe_subscription_id) {
    try {
      const subscription = await stripe.subscriptions.retrieve(user.stripe_subscription_id);
      
      // If subscription is active in Stripe but not in our DB, fix it
      if (subscription.status === 'active' && user.subscription_tier !== 'pro') {
        await query(
          'UPDATE users SET subscription_tier = $1 WHERE id = $2',
          ['pro', userId]
        );
        return {
          tier: 'pro',
          status: subscription.status,
          current_period_end: new Date(subscription.current_period_end * 1000)
        };
      }
      
      return {
        tier: user.subscription_tier,
        status: subscription.status,
        current_period_end: new Date(subscription.current_period_end * 1000)
      };
    } catch (error) {
      console.error('Error retrieving subscription from Stripe:', error);
      
      // Only default to basic if we can't verify the subscription
      if (user.subscription_tier === 'pro') {
        // Log this as it shouldn't happen often
        console.error('Pro user subscription verification failed:', {
          userId,
          stripe_subscription_id: user.stripe_subscription_id,
          error: error.message
        });
      }
      
      return {
        tier: user.subscription_tier, // Keep existing tier instead of defaulting to basic
        status: user.sub_status || 'unknown',
        current_period_end: user.current_period_end
      };
    }
  }

  // No subscription ID means basic tier
  return {
    tier: 'basic',
    status: 'inactive',
    current_period_end: null
  };
}; 
