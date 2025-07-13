import redis from 'redis';
import Redis from 'ioredis';

let redisClient = null;
let ioredisClient = null;

export const connectRedis = async () => {
  try {
    // Check if we have a Redis URL (for cloud Redis)
    const redisUrl = process.env.REDIS_URL;
    console.log(redisUrl);
    console.log("redis file check");
    
    
    if (redisUrl) {
      // Use Redis URL for cloud Redis
      console.log('Connecting to cloud Redis...');
      
      // Create Redis client for general operations
      redisClient = redis.createClient({
        url: redisUrl,
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            return new Error('The server refused the connection');
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            return new Error('Retry time exhausted');
          }
          if (options.attempt > 2) {
            return undefined;
          }
          return Math.min(options.attempt * 100, 3000);
        }
      });

      // Create ioredis client for BullMQ
      ioredisClient = new Redis(redisUrl, {
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: null, // Fix BullMQ deprecation warning
        lazyConnect: true
      });
    } else {
      // Fallback to local Redis for development
      console.log('Connecting to local Redis...');
      
      // Create Redis client for general operations
      redisClient = redis.createClient({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            return new Error('The server refused the connection');
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            return new Error('Retry time exhausted');
          }
          if (options.attempt > 10) {
            return undefined;
          }
          return Math.min(options.attempt * 100, 3000);
        }
      });

      // Create ioredis client for BullMQ
      ioredisClient = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: null, // Fix BullMQ deprecation warning
        lazyConnect: true
      });
    }

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      console.log('Redis connected successfully');
    });

    redisClient.on('ready', () => {
      console.log('Redis ready');
    });

    await redisClient.connect();

    ioredisClient.on('connect', () => {
      console.log('ioredis connected for BullMQ');
    });

    ioredisClient.on('error', (err) => {
      console.error('ioredis error:', err);
    });

    await ioredisClient.connect();
    console.log('ioredis ready for BullMQ');

  } catch (error) {
    console.error('Redis connection error:', error.message);
    process.exit(1);
  }
};

export const getRedisClient = () => {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }
  return redisClient;
};

// Get Redis connection for BullMQ (ioredis instance)
export const getRedisConnection = () => {
  if (!ioredisClient) {
    throw new Error('ioredis client not initialized');
  }
  return ioredisClient;
};

// Cache utilities
export const cache = {
  async set(key, value, ttl = process.env.CACHE_TTL || 600) {
    const client = getRedisClient();
    await client.setEx(key, ttl, JSON.stringify(value));
  },

  async get(key) {
    const client = getRedisClient();
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  },

  async del(key) {
    const client = getRedisClient();
    await client.del(key);
  },

  async exists(key) {
    const client = getRedisClient();
    return await client.exists(key);
  }
};

// Rate limiting utilities
export const rateLimit = {
  async increment(key, windowMs = 900000) {
    const client = getRedisClient();
    const current = await client.incr(key);
    if (current === 1) {
      await client.expire(key, Math.floor(windowMs / 1000));
    }
    return current;
  },

  async get(key) {
    const client = getRedisClient();
    const value = await client.get(key);
    return value ? parseInt(value) : 0;
  },

  async reset(key) {
    const client = getRedisClient();
    await client.del(key);
  }
}; 