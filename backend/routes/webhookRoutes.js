const express = require('express');
const {
  verifyWebhook,
  handleWebhook,
} = require('../controllers/webhookController');

const router = express.Router();

// Rota de verificação da Meta (GET /webhook)
router.get('/webhook', verifyWebhook);

// Rota de recebimento de mensagens do WhatsApp (POST /webhook)
router.post('/webhook', handleWebhook);

module.exports = router;
