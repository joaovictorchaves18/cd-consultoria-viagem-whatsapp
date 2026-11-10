require('dotenv').config();
const express = require('express');
const cors = require('cors');
const webhookRoutes = require('./routes/webhookRoutes');
const { iniciarBaileys, getBaileysStatus } = require('./services/baileys');

const app = express();
const PORT = process.env.PORT_BACKEND || 3001;

app.use(cors());
app.use(express.json());

// Log de todas as requisições que chegam no backend
app.use((req, res, next) => {
  if (req.url !== '/qr/status') {
    console.log(`[HTTP ${req.method}] ${req.url}`);
  }
  if (req.method === 'POST') {
    console.log('[Payload Recebido]:', JSON.stringify(req.body));
  }
  next();
});

// Healthcheck
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'suica-whatsapp-backend',
    whatsappDirect: getBaileysStatus(),
    timestamp: new Date().toISOString(),
  });
});

// Status JSON do QR Code
app.get('/qr/status', (req, res) => {
  res.status(200).json(getBaileysStatus());
});

// Página visual para escanear o QR Code do WhatsApp no navegador
app.get('/qr', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Conectar WhatsApp • CD Consultoria de Viagem</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-900 text-white min-h-screen flex items-center justify-center p-4">
  <div class="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-8 text-center shadow-2xl">
    <div class="w-14 h-14 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center text-xl font-extrabold mb-4 shadow">
      CD
    </div>
    <h1 class="text-xl font-bold">Conectar WhatsApp • CD Consultoria de Viagem</h1>
    <p class="text-sm text-slate-400 mt-1">
      Escaneie o QR Code abaixo no seu celular em:<br/>
      <strong class="text-slate-200">WhatsApp &gt; Aparelhos conectados &gt; Conectar um aparelho</strong>
    </p>

    <div id="qr-container" class="my-6 flex flex-col items-center justify-center min-h-[280px] bg-slate-900/60 rounded-xl p-4 border border-slate-700">
      <p class="text-sm text-slate-400 animate-pulse">Gerando QR Code...</p>
    </div>

    <div id="status-badge" class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
      Aguardando leitura do QR Code...
    </div>

    <div class="mt-6 pt-5 border-t border-slate-700 text-left text-xs text-slate-300 space-y-2">
      <p class="font-semibold text-white">Como testar após conectar:</p>
      <p>1. Envie a frase abaixo no WhatsApp:</p>
      <div class="bg-slate-950 p-2.5 rounded-lg border border-slate-700 font-mono text-[11px] text-emerald-400 select-all">
        Olá! Vim pelo site da CD Consultoria de Viagem e gostaria de fazer um orçamento.
      </div>
      <p>2. O bot responderá direto no seu WhatsApp fazendo as 5 perguntas rápidas até completar a ficha no <a href="http://localhost:3000/dashboard" target="_blank" class="underline text-blue-400">Dashboard da CD Consultoria</a>!</p>
    </div>
  </div>

  <script>
    async function atualizarQR() {
      try {
        const res = await fetch('/qr/status');
        const data = await res.json();
        const container = document.getElementById('qr-container');
        const badge = document.getElementById('status-badge');

        if (data.status === 'CONNECTED') {
          container.innerHTML = '<div class="text-center py-8"><div class="text-5xl mb-3">✅</div><p class="text-lg font-bold text-emerald-400">WhatsApp Conectado!</p><p class="text-xs text-slate-400 mt-1">Número: +' + (data.connectedNumber || '') + '</p></div>';
          badge.className = 'inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
          badge.innerText = 'Bot Ativo e Respondendo no WhatsApp';
        } else if (data.qrCodeDataUrl) {
          container.innerHTML = '<img src="' + data.qrCodeDataUrl + '" alt="QR Code WhatsApp" class="rounded-xl shadow-lg bg-white p-2" />';
          badge.className = 'inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30';
          badge.innerText = 'Escaneie o QR Code com seu celular';
        } else {
          container.innerHTML = '<p class="text-sm text-slate-400 animate-pulse">Inicializando sessão do WhatsApp...</p>';
        }
      } catch (e) {
        console.error(e);
      }
    }
    atualizarQR();
    setInterval(atualizarQR, 2500);
  </script>
</body>
</html>`);
});

// Rotas do Webhook WhatsApp Cloud API
app.use('/', webhookRoutes);

// Middleware global de tratamento de erros
app.use((err, req, res, next) => {
  console.error('[Express Server Error]:', err);
  res.status(500).json({ error: 'Erro interno no servidor.' });
});

app.listen(PORT, () => {
  console.log(`🚀 Backend WhatsApp/OpenAI rodando na porta ${PORT}`);
  console.log(`🔗 Endpoint do Webhook: http://localhost:${PORT}/webhook`);
  console.log(`📱 Conectar WhatsApp via QR Code: http://localhost:${PORT}/qr`);
  iniciarBaileys();
});
