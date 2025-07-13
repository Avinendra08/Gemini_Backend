import { rateLimit } from '../config/redis.js';

const rateLimiter = async (req, res, next) => {
  try {
    const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000; // 15 minutes
    const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;
    
    const key = `rate_limit:${req.ip}`;
    const current = await rateLimit.increment(key, windowMs);
    
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - current));
    res.setHeader('X-RateLimit-Reset', new Date(Date.now() + windowMs).toISOString());
    
    if (current > maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests, please try again later',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
    
    next();
  } catch (error) {
    console.error('Rate limiting error:', error);
    next(); // Continue without rate limiting if Redis is down
  }
};

export default rateLimiter; 