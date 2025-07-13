import { query } from '../config/database.js';
import { cache, rateLimit } from '../config/redis.js';
import { addMessageToQueue } from '../queue/queue.js';

// Create new chatroom
export const  createChatroom = async (req, res) => {
  try {
    const { name, description } = req.body;
    const userId = req.user.id;
    
    const result = await query(
      `INSERT INTO chatrooms (user_id, name, description) 
       VALUES ($1, $2, $3) 
       RETURNING id, name, description, created_at`,
      [userId, name, description]
    );
    
    // Clear cache for user's chatrooms
    await cache.del(`chatrooms:${userId}`);
    
    res.status(201).json({
      success: true,
      message: 'Chatroom created successfully',
      chatroom: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get all chatrooms for user (with caching)
export const getChatrooms = async (req, res) => {
  try {
    const userId = req.user.id;
    const cacheKey = `chatrooms:${userId}`;
    
    // Try to get from cache first
    const cachedChatrooms = await cache.get(cacheKey);
    if (cachedChatrooms) {
      return res.status(200).json({
        success: true,
        chatrooms: cachedChatrooms,
        cached: true
      });
    }
    
    // Get from database
    const result = await query(
      `SELECT c.id, c.name, c.description, c.created_at,
              COUNT(m.id) as message_count,
              MAX(m.created_at) as last_message_at
       FROM chatrooms c
       LEFT JOIN messages m ON c.id = m.chatroom_id
       WHERE c.user_id = $1
       GROUP BY c.id, c.name, c.description, c.created_at
       ORDER BY c.created_at DESC`,
      [userId]
    );
    
    const chatrooms = result.rows;
    
    // Cache the result for 10 minutes
    await cache.set(cacheKey, chatrooms, 600);
    
    res.status(200).json({
      success: true,
      chatrooms,
      cached: false
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get single chatroom with messages
export const getChatroom = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Check if chatroom belongs to user
    const chatroomResult = await query(
      'SELECT * FROM chatrooms WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    
    if (chatroomResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Chatroom not found'
      });
    }
    
    // Get messages for chatroom
    const messagesResult = await query(
      `SELECT id, content, message_type, processing_status, created_at
       FROM messages 
       WHERE chatroom_id = $1 
       ORDER BY created_at ASC`,
      [id]
    );
    
    const chatroom = chatroomResult.rows[0];
    const messages = messagesResult.rows;
    
    res.status(200).json({
      success: true,
      chatroom,
      messages
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Send message to chatroom
export const sendMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user.id;
    
    // Check if chatroom belongs to user
    const chatroomResult = await query(
      'SELECT * FROM chatrooms WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    
    if (chatroomResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Chatroom not found'
      });
    }
    
    // Check daily message limit for basic users
    const user = req.user;
    const today = new Date().toISOString().split('T')[0]; // Get YYYY-MM-DD format
    
    if (user.subscription_tier === 'basic') {
      const dailyLimit = parseInt(process.env.BASIC_DAILY_MESSAGE_LIMIT) || 5;
      
      // Get current user data from database to check daily message count
      const userResult = await query(
        'SELECT daily_message_count, last_message_date FROM users WHERE id = $1',
        [userId]
      );
      
      const currentUser = userResult.rows[0];
      const lastMessageDate = currentUser.last_message_date ? 
        currentUser.last_message_date.toISOString().split('T')[0] : null;
      
      // Reset counter if it's a new day
      if (lastMessageDate !== today) {
        await query(
          'UPDATE users SET daily_message_count = 0, last_message_date = $1 WHERE id = $2',
          [today, userId]
        );
      }
      
      // Check if user has exceeded daily limit
      if (currentUser.daily_message_count >= dailyLimit) {
        return res.status(429).json({
          success: false,
          message: `Daily message limit of ${dailyLimit} reached. Upgrade to Pro for unlimited messages.`
        });
      }
      
      // Increment daily message count
      await query(
        'UPDATE users SET daily_message_count = daily_message_count + 1 WHERE id = $1',
        [userId]
      );
    }
    
    // Store user message
    const messageResult = await query(
      `INSERT INTO messages (chatroom_id, user_id, content, message_type, processing_status) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, content, created_at`,
      [id, userId, content, 'user', 'pending']
    );
    
    const message = messageResult.rows[0];
    
    // Add message to processing queue
    await addMessageToQueue({
      messageId: message.id,
      chatroomId: id,
      userId,
      content
    });
    
    // Clear cache for user's chatrooms
    await cache.del(`chatrooms:${userId}`);
    
    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      message: {
        id: message.id,
        content: message.content,
        message_type: 'user',
        processing_status: 'pending',
        created_at: message.created_at
      },
      queue_status: 'processing'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get message status
export const getMessageStatus = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;
    
    const result = await query(
      `SELECT m.id, m.content, m.message_type, m.processing_status, m.created_at,
              c.id as chatroom_id, c.name as chatroom_name
       FROM messages m
       JOIN chatrooms c ON m.chatroom_id = c.id
       WHERE m.id = $1 AND c.user_id = $2`,
      [messageId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }
    
    const message = result.rows[0];
    
    res.status(200).json({
      success: true,
      message
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete chatroom
export const deleteChatroom = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const result = await query(
      'DELETE FROM chatrooms WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Chatroom not found'
      });
    }
    
    // Clear cache for user's chatrooms
    await cache.del(`chatrooms:${userId}`);
    
    res.status(200).json({
      success: true,
      message: 'Chatroom deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}; 