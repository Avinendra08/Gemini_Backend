import { GoogleGenerativeAI } from '@google/generative-ai';

class GeminiService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
  }

  // Generate response from Gemini
  async generateResponse(userMessage, conversationHistory = []) {
    try {
      // Build conversation context
      const conversation = [
        {
          role: 'user',
          parts: [{ text: 'You are a helpful AI assistant. Provide clear, concise, and helpful responses.' }]
        },
        ...conversationHistory,
        {
          role: 'user',
          parts: [{ text: userMessage }]
        }
      ];

      const result = await this.model.generateContent({
        contents: conversation,
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
      });

      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Gemini API error:', error);
      throw new Error('Failed to generate AI response');
    }
  }

  // Process message with context
  async processMessage(message, chatroomId, userId) {
    try {
      // Get conversation history for context (last 10 messages)
      const { query } = await import('../config/database.js');
      const historyResult = await query(
        `SELECT content, message_type, created_at 
         FROM messages 
         WHERE chatroom_id = $1 
         ORDER BY created_at DESC 
         LIMIT 10`,
        [chatroomId]
      );

      // Build conversation history for Gemini
      const conversationHistory = historyResult.rows
        .reverse()
        .map(msg => ({
          role: msg.message_type === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        }));

      // Generate response
      const aiResponse = await this.generateResponse(message, conversationHistory);

      return {
        success: true,
        response: aiResponse,
        conversationHistory: conversationHistory.length
      };
    } catch (error) {
      console.error('Error processing message:', error);
      throw new Error('Failed to process message with AI');
    }
  }

  // Validate API key
  async validateAPIKey() {
    try {
      const result = await this.model.generateContent('Hello');
      await result.response;
      return true;
    } catch (error) {
      console.error('Invalid Gemini API key:', error);
      return false;
    }
  }
}

export default new GeminiService(); 