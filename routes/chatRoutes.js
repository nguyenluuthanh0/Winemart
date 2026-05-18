const express = require('express');
const router = express.Router();

// Nhúng file chatController chúng ta vừa tạo ở Bước 2
const chatController = require('../controllers/chatController');

// Mở tuyến đường POST /api/chat để nhận tin nhắn từ giao diện
router.post('/api/chat', chatController.chatWithAI);

module.exports = router;