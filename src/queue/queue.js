import { Queue, Worker } from 'bullmq';
import { getRedisConnection } from '../config/redis.js';
import geminiService from '../services/geminiService.js';
import { query } from '../config/database.js';

let messageQueue;
let messageWorker;

// Initialize queue with proper connection handling
const initializeQueue = async () => {
  try {
    console.log('Initializing message queue...');
    const redisConnection = getRedisConnection();
    
    console.log('Redis connection config:', redisConnection);
    
    messageQueue = new Queue('message-processing', {
      connection: redisConnection
    });
    
    console.log('Message queue created successfully');
    
    return messageQueue;
  } catch (error) {
    console.error('Error initializing queue:', error);
    throw error;
  }
};

// Initialize worker with proper connection handling
const initializeWorker = async () => {
  try {
    console.log('Initializing message worker...');
    const redisConnection = getRedisConnection();
    
    messageWorker = new Worker('message-processing', async (job) => {
      try {
        const { messageId, chatroomId, userId, content } = job.data;
        
        console.log(`Processing message ${messageId} for user ${userId}`);
        
        // Update message status to processing
        await query(
          'UPDATE messages SET processing_status = $1 WHERE id = $2',
          ['processing', messageId]
        );

        // Process message with Gemini
        const result = await geminiService.processMessage(content, chatroomId, userId);
        
        // Store AI response
        await query(
          `INSERT INTO messages (chatroom_id, user_id, content, message_type, processing_status) 
           VALUES ($1, $2, $3, $4, $5)`,
          [chatroomId, userId, result.response, 'ai', 'completed']
        );

        // Update original message status
        await query(
          'UPDATE messages SET processing_status = $1 WHERE id = $2',
          ['completed', messageId]
        );

        console.log(`Message ${messageId} processed successfully`);
        
        return {
          success: true,
          messageId,
          aiResponse: result.response
        };
      } catch (error) {
        console.error('Error processing message:', error);
        
        // Update message status to failed
        await query(
          'UPDATE messages SET processing_status = $1 WHERE id = $2',
          ['failed', job.data.messageId]
        );
        
        throw error;
      }
    }, {
      connection: redisConnection,
      concurrency: 5 // Process 5 jobs concurrently
    });

    // Handle worker events
    messageWorker.on('completed', (job) => {
      console.log(`Job ${job.id} completed successfully`);
    });

    messageWorker.on('failed', (job, err) => {
      console.error(`Job ${job.id} failed:`, err.message);
    });

    messageWorker.on('error', (err) => {
      console.error('Worker error:', err);
    });

    console.log('Message worker created successfully');
    return messageWorker;
  } catch (error) {
    console.error('Error initializing worker:', error);
    throw error;
  }
};

// Add message to queue
export const addMessageToQueue = async (messageData) => {
  try {
    console.log('Starting to add message to queue...');
    console.log('Message data:', messageData);
    
    // Ensure queue is initialized
    if (!messageQueue) {
      console.log('Queue not initialized, creating new queue...');
      await initializeQueue();
    }
    
    console.log('Queue object:', messageQueue);
    console.log('Queue name:', messageQueue.name);
    
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Queue operation timed out')), 10000); // 10 second timeout
    });
    
    console.log('Adding job to queue...');
    const queuePromise = messageQueue.add('process-message', messageData, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      },
      removeOnComplete: 100,
      removeOnFail: 50
    });
    
    const job = await Promise.race([queuePromise, timeoutPromise]);
    
    console.log(`Message queued with job ID: ${job.id}`);
    return job;
  } catch (error) {
    console.error('Error adding message to queue:', error);
    console.error('Error stack:', error.stack);
    throw error;
  }
};

// Get queue status
export const getQueueStatus = async () => {
  try {
    if (!messageQueue) {
      await initializeQueue();
    }
    
    const waiting = await messageQueue.getWaiting();
    const active = await messageQueue.getActive();
    const completed = await messageQueue.getCompleted();
    const failed = await messageQueue.getFailed();
    
    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length
    };
  } catch (error) {
    console.error('Error getting queue status:', error);
    throw error;
  }
};

// Clean up completed jobs
const cleanupQueue = async () => {
  try {
    if (!messageQueue) return;
    
    await messageQueue.clean(1000 * 60 * 60 * 24, 'completed'); // Clean jobs older than 24 hours
    await messageQueue.clean(1000 * 60 * 60 * 24, 'failed'); // Clean failed jobs older than 24 hours
    console.log('Queue cleanup completed');
  } catch (error) {
    console.error('Error cleaning up queue:', error);
  }
};

// Schedule cleanup every hour
setInterval(cleanupQueue, 1000 * 60 * 60);

// Initialize queue and worker when module is loaded
(async () => {
  try {
    await initializeQueue();
    await initializeWorker();
    console.log('Queue and worker initialized successfully');
  } catch (error) {
    console.error('Failed to initialize queue and worker:', error);
  }
})();

export { messageQueue, messageWorker }; 