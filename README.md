# Gemini Backend API

A production-ready Node.js backend system with Gemini AI integration, Stripe subscriptions, and BullMQ queues.

## 🚀 Features

- **Authentication**: JWT-based auth with OTP verification
- **AI Integration**: Google Gemini API for intelligent responses
- **Queue System**: BullMQ with Redis for async message processing
- **Subscriptions**: Stripe integration for Basic/Pro tiers
- **Rate Limiting**: Redis-based rate limiting and daily message limits
- **Caching**: Redis caching for improved performance
- **Database**: PostgreSQL(NeonDB) for data persistence
- **Security**: Helmet, CORS, input validation

## 📋 Prerequisites

- Node.js 18+ 
- PostgreSQL(Neon Db)
- Redis 6+
- Stripe account (for payments)
- Google Gemini API key

## 🛠 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd gemini-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment setup**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   # Server Configuration
   NODE_ENV=development
   PORT=3000

   # Database Configuration
   DATABASE_URL= your neon db url

   # Redis Configuration
   REDIS_URL= your cloud redis url

   # JWT Configuration
   JWT_SECRET=your_super_secret_jwt_key_here
   JWT_EXPIRES_IN=7d

   # Stripe Configuration (Sandbox)
   STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
   STRIPE_PRICE_ID=price_your_pro_subscription_price_id

   # Google Gemini API
   GEMINI_API_KEY=your_gemini_api_key_here

   # Rate Limiting
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100

   # Subscription Limits
   BASIC_DAILY_MESSAGE_LIMIT=5
   PRO_DAILY_MESSAGE_LIMIT=1000

   # Cache Configuration
   CACHE_TTL=600
   ```

4. **Database setup**
   ```
   just set up your db and url in neon db
   ```

5. **Start the application**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

6. **Start the queue worker** (in a separate terminal)
   ```bash
   npm run queue:worker
   ```

## 🏗 Project Structure

```
src/
├── config/
│   ├── database.js      # PostgreSQL configuration
│   └── redis.js         # Redis configuration
├── controllers/
│   ├── authController.js
│   ├── chatroomController.js
│   ├── subscriptionController.js
│   ├── userController.js
│   └── webhookController.js
├── middleware/
│   ├── auth.js          # JWT authentication
│   ├── errorHandler.js  # Error handling
│   └── rateLimiter.js   # Rate limiting
├── queue/
│   ├── queue.js         # BullMQ configuration
│   └── worker.js        # Queue worker
├── routes/
│   ├── auth.js
│   ├── chatroom.js
│   ├── subscription.js
│   ├── user.js
│   └── webhook.js
├── services/
│   ├── authService.js   # Authentication logic
│   ├── geminiService.js # Gemini AI integration
│   └── stripeService.js # Stripe integration
├── utils/
│   └── validators.js    # Request validation
└── server.js            # Main application
```

## 🔌 API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Endpoint for login |
| POST | `/api/auth/send-signup-otp` | Send OTP for signup |
| POST | `/api/auth/verify-signup-otp` | Verify OTP while sign up |
| POST | `/api/auth/forgot-password` | Send password reset OTP |
| POST | `/api/auth/change-password` | Change password (JWT required) |

### User Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/user/me` | Get user profile |
| PUT | `/api/user/me` | Update user profile |
| GET | `/api/user/stats` | Get user statistics |

### Chatrooms

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chatroom` | Create new chatroom |
| GET | `/api/chatroom` | List user's chatrooms (cached) |
| GET | `/api/chatroom/:id` | Get chatroom with messages |
| DELETE | `/api/chatroom/:id` | Delete chatroom |
| POST | `/api/chatroom/:id/message` | Send message to chatroom |
| GET | `/api/chatroom/message/:messageId/status` | Get message processing status |

### Subscriptions

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/subscription/pro` | Create Stripe checkout session |
| GET | `/api/subscription/status` | Get subscription status |
| GET | `/api/subscription/plans` | Get available plans |

### Webhooks
These are called automatically when /subscription/pro route is hitted for pro subscription.
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/webhook/stripe` | Stripe webhook handler |
| GET | `/api/webhook/test` | Test webhook endpoint |

## 🔄 Queue System

The application uses BullMQ with Redis for asynchronous message processing:

### Message Processing Flow

1. **User sends message** → Stored in database with `pending` status
2. **Message queued** → Added to BullMQ queue
3. **Worker processes** → Calls Gemini API
4. **AI response stored** → Saved as separate message
5. **Status updated** → Original message marked as `completed`

### Queue Management

```bash
# Start worker process
npm run queue:worker

# Monitor queue status
curl http://localhost:3000/api/queue/status
```

### Queue Configuration

- **Concurrency**: 5 jobs processed simultaneously
- **Retry Logic**: 3 attempts with exponential backoff
- **Cleanup**: Jobs cleaned after 24 hours
- **Error Handling**: Failed jobs logged and tracked

## 💳 Stripe Integration

### Setup

1. **Create Stripe account** and get API keys
2. **Create product/price** in Stripe dashboard
3. **Set webhook endpoint** to `https://your-domain.com/api/webhook/stripe`
4. **Configure environment variables**

### Testing

Use Stripe test cards:
- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`

### Webhook Events Handled

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

## 🤖 Gemini AI Integration

### Configuration

1. **Get API key** from Google AI Studio
2. **Set environment variable**: `GEMINI_API_KEY`
3. **Test connection**: Health check endpoint

### Features

- **Conversation Context**: Maintains chat history
- **Error Handling**: Graceful API failures
- **Rate Limiting**: Respects API limits
- **Response Caching**: Optional response caching

### Usage Limits

- **Basic tier**: 5 messages/day
- **Pro tier**: 1000 messages/day
- **Rate limiting**: Per-user and global limits

## 🗄 Database Schema

### Tables

- **users**: User accounts and subscription info
- **chatrooms**: User chatrooms
- **messages**: User and AI messages
- **subscriptions**: Stripe subscription data

## 🔒 Security Features

- **JWT Authentication**: Secure token-based auth
- **Input Validation**: Joi schema validation
- **Rate Limiting**: Redis-based rate limiting
- **CORS Protection**: Configured CORS headers
- **Helmet Security**: Security headers
- **SQL Injection Protection**: Parameterized queries

## 📊 Caching Strategy

### Redis Caching

- **Chatroom lists**: 10-minute TTL
- **User sessions**: JWT token storage
- **Rate limiting**: Request counters
- **OTP storage**: 5-minute expiration

### Cache Keys

```
chatrooms:{userId}     # User's chatrooms
otp:{mobile}:{type}    # OTP verification
rate_limit:{ip}        # Rate limiting
```

## 🚀 Deployment: https://gemini-backend-2-qjgx.onrender.com

### Environment Variables

Ensure all required environment variables are set, all fields of sample env file(below).
```
# Server Configuration
NODE_ENV=development
PORT=3000

# Database Configuration
DATABASE_URL=postgresql://your_user:your_password@your_host/your_database?sslmode=require&channel_binding=require

# Redis Configuration
REDIS_URL=redis://default:your_redis_password@your_redis_host:your_redis_port

# JWT Configuration
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d

# Stripe Configuration (Sandbox)
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
STRIPE_PRICE_ID=your_stripe_price_id

# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Subscription Limits
BASIC_DAILY_MESSAGE_LIMIT=5
PRO_DAILY_MESSAGE_LIMIT=1000

# Cache Configuration
CACHE_TTL=600
```
