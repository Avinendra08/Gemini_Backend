import { query } from '../config/database.js';

// Get current user profile
export const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await query(
      `SELECT id, mobile_number, name, subscription_tier, 
              daily_message_count, last_message_date, created_at
       FROM users WHERE id = $1`,
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const user = result.rows[0];
    
    // Calculate daily message usage
    const dailyLimit = user.subscription_tier === 'basic' 
      ? parseInt(process.env.BASIC_DAILY_MESSAGE_LIMIT) || 5
      : parseInt(process.env.PRO_DAILY_MESSAGE_LIMIT) || 1000;
    
    const usage = {
      daily_messages_used: user.daily_message_count || 0,
      daily_message_limit: dailyLimit,
      remaining_messages: Math.max(0, dailyLimit - (user.daily_message_count || 0))
    };
    
    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        mobile_number: user.mobile_number,
        name: user.name,
        subscription_tier: user.subscription_tier,
        created_at: user.created_at
      },
      usage
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update user profile
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name } = req.body;
    
    const result = await query(
      `UPDATE users 
       SET name = COALESCE($1, name),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, mobile_number, name, subscription_tier`,
      [name, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get user statistics
export const getStats = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get chatroom count
    const chatroomResult = await query(
      'SELECT COUNT(*) as chatroom_count FROM chatrooms WHERE user_id = $1',
      [userId]
    );
    
    // Get message count
    const messageResult = await query(
      'SELECT COUNT(*) as message_count FROM messages WHERE user_id = $1',
      [userId]
    );
    
    // Get AI response count
    const aiResponseResult = await query(
      `SELECT COUNT(*) as ai_response_count 
       FROM messages 
       WHERE user_id = $1 AND message_type = 'ai'`,
      [userId]
    );
    
    const stats = {
      chatroom_count: parseInt(chatroomResult.rows[0].chatroom_count),
      message_count: parseInt(messageResult.rows[0].message_count),
      ai_response_count: parseInt(aiResponseResult.rows[0].ai_response_count)
    };
    
    res.status(200).json({
      success: true,
      stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}; 