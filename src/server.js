import dotenv from 'dotenv';
dotenv.config();

console.log('REDIS_URL:', process.env.REDIS_URL);

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

import { connectDB } from './config/database.js';
import { connectRedis } from './config/redis.js';
import errorHandler from './middleware/errorHandler.js';
import rateLimiter from './middleware/rateLimiter.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to database
connectDB();

(async () => {
  await connectRedis(); // Wait for Redis to connect

  // Now import modules that use Redis
  const authRoutes = (await import('./routes/auth.js')).default;
  const userRoutes = (await import('./routes/user.js')).default;
  const chatroomRoutes = (await import('./routes/chatroom.js')).default;
  const subscriptionRoutes = (await import('./routes/subscription.js')).default;
  const webhookRoutes = (await import('./routes/webhook.js')).default;
  await import('./queue/queue.js');

  // Middleware
  app.use(helmet());
  app.use(compression());
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan('combined'));

  // Rate limiting
  app.use(rateLimiter);

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/user', userRoutes);
  app.use('/api/chatroom', chatroomRoutes);
  app.use('/api/subscription', subscriptionRoutes);
  app.use('/api/webhook', webhookRoutes);

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      message: 'Route not found'
    });
  });

  // Error handling middleware
  app.use(errorHandler);

  // Start server
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
})();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

export default app; 