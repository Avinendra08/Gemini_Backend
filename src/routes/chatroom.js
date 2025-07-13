import express from 'express';
import { 
  createChatroom, 
  getChatrooms, 
  getChatroom, 
  deleteChatroom, 
  sendMessage, 
  getMessageStatus 
} from '../controllers/chatroomController.js';
import { validators, validate } from '../utils/validators.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(auth);

// Chatroom routes
router.post('/', validate(validators.createChatroom), createChatroom);
router.get('/', getChatrooms);
router.get('/:id', getChatroom);
router.delete('/:id', deleteChatroom);

// Message routes
router.post('/:id/message', validate(validators.sendMessage), sendMessage);
router.get('/message/:messageId/status', getMessageStatus);

export default router; 