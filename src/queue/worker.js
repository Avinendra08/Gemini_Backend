import dotenv from 'dotenv';
import { connectDB } from '../config/database.js';
import { connectRedis } from '../config/redis.js';

dotenv.config();

// Connect to database
connectDB();

(async () => {
  await connectRedis(); // Wait for Redis to connect

  // Now import the queue (which will start the worker)
  await import('./queue.js');

  // Optionally, log that the worker is running
  console.log('🚦 Queue worker is running and connected to Redis.');
})();

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down worker gracefully');
  // The queue worker will handle its own shutdown
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down worker gracefully');
  // The queue worker will handle its own shutdown
  process.exit(0);
});

// Keep the process alive
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
}); 