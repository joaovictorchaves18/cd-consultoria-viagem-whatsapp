const fs = require('fs');
const path = require('path');
const pino = require('pino');
const QRCode = require('qrcode');
const prisma = require('./prisma');
const {
  processarMensagemRecebida,
  verificarFraseGatilho,
} = require('../controllers/webhookController');

let sock = null;
let qrCodeDataUrl = null;
let connectionStatus = 'STARTING'; // STARTING, QR_READY, CONNECTED, DISCONNECTED
let connectedNumber = null;

// Guarda IDs de mensagens enviadas pelo próprio bot para evitar loop infinito quando o usuário testa mandando mensagem para si mesmo
const botSentMessageIds = new Set();

const AUTH_FOLDER = path.join(__dirname, '..', '..', '.baileys_auth');

/**
 * Converte um JID ou LID (ex: "144396917932074@lid") para o número de telefone real (ex: "558182240109")
 * consultando os campos da mensagem (senderPn) ou o arquivo lid-mapping-{lid}_reverse.json do Baileys.
 * @param {object} msg - Objeto de mensagem do Baileys
 * @returns {string} Número de telefone real contendo apenas dígitos
 */
function resolverTelefoneReal(msg) {
  const key = msg?.key || {};
  const remoteJid = key.remoteJid || '';

  // 1. Verifica campos diretos de Phone Number presentes nas versões recentes do Baileys v7
  const candidatosDiretos = [
    key.senderPn,
    key.remoteJidAlt,
    key.participantPn,
    msg?.senderPn,
    msg?.userReceipt?.[0]?.userJid,
  ];

  for (const cand of candidatosDiretos) {
    if (cand && String(cand).endsWith('@s.whatsapp.net')) {
      const limpo = String(cand).split('@')[0].split(':')[0].replace(/\D/g, '');
      if (limpo) return limpo;
    }
  }

  // 2. Se o próprio remoteJid já for @s.whatsapp.net, extrai direto os dígitos
  if (remoteJid.endsWith('@s.whatsapp.net')) {
    return remoteJid.split('@')[0].split(':')[0].replace(/\D/g, '');
  }

  // 3. Se for @lid, consulta o mapeamento reverso salvo em .baileys_auth/lid-mapping-{lid}_reverse.json
  const lidId = remoteJid.split('@')[0].split(':')[0].replace(/\D/g, '');
  if (lidId) {
    try {
      const reverseFilePath = path.join(
        AUTH_FOLDER,
        `lid-mapping-${lidId}_reverse.json`
      );
      if (fs.existsSync(reverseFilePath)) {
        const raw = fs.readFileSync(reverseFilePath, 'utf-8');
        const mappedPhone = JSON.parse(raw);
        if (mappedPhone) {
          const phoneDigits = String(mappedPhone)
            .split('@')[0]
            .split(':')[0]
            .replace(/\D/g, '');
          if (phoneDigits) return phoneDigits;
        }
      }
    } catch (err) {
      console.warn(
        `[WhatsApp Direto] Não foi possível ler lid-mapping para ${lidId}:`,
        err.message
      );
    }
  }

  return lidId;
}

/**
 * Migra automaticamente qualquer atendimento no banco que tenha sido salvo com LID numérico
 * para o seu número de telefone real correspondente usando os arquivos lid-mapping-{lid}_reverse.json
 */
async function corrigirTelefonesLidNoBanco() {
  try {
    const todos = await prisma.atendimento.findMany();
    for (const item of todos) {
      const reverseFile = path.join(
        AUTH_FOLDER,
        `lid-mapping-${item.telefone}_reverse.json`
      );
      if (fs.existsSync(reverseFile)) {
        const realPhone = String(
          JSON.parse(fs.readFileSync(reverseFile, 'utf-8'))
        ).replace(/\D/g, '');
        if (!realPhone) continue;

        const existente = await prisma.atendimento.findUnique({
          where: { telefone: realPhone },
        });

        if (existente && existente.id !== item.id) {
          const temResumo =
            item.resumoViagem && Object.keys(item.resumoViagem).length > 0;
          if (temResumo) {
            await prisma.atendimento.update({
              where: { id: existente.id },
              data: {
                nome: item.nome || existente.nome,
                status: item.status,
                etapaBot: item.etapaBot,
                resumoViagem: item.resumoViagem,
                historico: item.historico,
              },
            });
          }
          await prisma.atendimento.delete({ where: { id: item.id } });
          console.log(
            `[WhatsApp Direto] Registro LID ${item.telefone} mesclado no número real ${realPhone}`
          );
        } else {
          await prisma.atendimento.update({
            where: { id: item.id },
            data: { telefone: realPhone },
          });
          console.log(
            `[WhatsApp Direto] Registro ${item.nome} atualizado de LID ${item.telefone} para número real +${realPhone}`
          );
        }
      }
    }
  } catch (err) {
    console.warn(
      '[WhatsApp Direto] Aviso ao migrar LIDs no banco:',
      err.message
    );
  }
}

async function iniciarBaileys() {
  try {
    await corrigirTelefonesLidNoBanco();
    const baileys = await import('@whiskeysockets/baileys');
    const makeWASocket =
      baileys.default?.default || baileys.default || baileys.makeWASocket;
    const {
      useMultiFileAuthState,
      DisconnectReason,
      fetchLatestBaileysVersion,
    } = baileys;

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);

    let version = [2, 3000, 1015901307];
    try {
      const latest = await fetchLatestBaileysVersion();
      if (latest?.version) version = latest.version;
    } catch {
      // Usa versão padrão se falhar busca
    }

    sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      browser: ['Suica Concierge Bot', 'Chrome', '1.0.0'],
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        connectionStatus = 'QR_READY';
        qrCodeDataUrl = await QRCode.toDataURL(qr, { width: 320, margin: 2 });
        console.log(
          '📱 [WhatsApp Direto] QR Code gerado! Acesse http://localhost:3001/qr para escanear com seu WhatsApp.'
        );
      }

      if (connection === 'open') {
        connectionStatus = 'CONNECTED';
        qrCodeDataUrl = null;
        connectedNumber = sock.user?.id
          ? sock.user.id.split(':')[0]
          : 'Conectado';
        console.log(
          `✅ [WhatsApp Direto] Conectado com sucesso no número: ${connectedNumber}`
        );
      }

      if (connection === 'close') {
        connectionStatus = 'DISCONNECTED';
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        console.log(
          `⚠️ [WhatsApp Direto] Conexão fechada (status=${statusCode}). Reconectar: ${shouldReconnect}`
        );
        if (shouldReconnect) {
          setTimeout(() => iniciarBaileys(), 3000);
        }
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        try {
          if (!msg.message) continue;

          const msgId = msg.key?.id;
          if (msgId && botSentMessageIds.has(msgId)) {
            continue;
          }

          const remoteJid = msg.key?.remoteJid || '';
          if (
            remoteJid.endsWith('@g.us') ||
            remoteJid === 'status@broadcast' ||
            remoteJid.endsWith('@newsletter')
          ) {
            continue;
          }

          const texto =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            '';

          if (!texto.trim()) continue;

          // Ignora mensagens antigas de sincronização de histórico offline (mais de 60 segundos atrás)
          const msgTimestamp = Number(msg.messageTimestamp || 0);
          const agoraSegundos = Math.floor(Date.now() / 1000);
          if (msgTimestamp > 0 && agoraSegundos - msgTimestamp > 60) {
            continue;
          }

          // Resolve o número de telefone REAL (convertendo @lid para o número +55... real)
          const numeroLimpo = resolverTelefoneReal(msg);
          const nomePerfil = msg.pushName || 'Cliente WhatsApp';

          const selfNumber = (sock.user?.id || '')
            .split(':')[0]
            .replace(/\D/g, '');
          const isSelfChat = numeroLimpo === selfNumber;

          if (msg.key.fromMe) {
            const isTrigger = verificarFraseGatilho(texto);

            if (!isSelfChat && !isTrigger) {
              continue;
            }
          }

          await processarMensagemRecebida({
            telefone: numeroLimpo,
            textoRecebido: texto.trim(),
            nomePerfil,
            customSend: async (_to, respostaTexto) => {
              // Para conversa consigo mesmo ("Vitinho (você)"), envia também para o JID @s.whatsapp.net
              // para aparecer imediatamente no WhatsApp Web além do celular!
              const targetJid =
                isSelfChat && numeroLimpo
                  ? `${numeroLimpo}@s.whatsapp.net`
                  : remoteJid;

              const sent = await sock.sendMessage(targetJid, {
                text: respostaTexto,
              });
              if (sent?.key?.id) {
                botSentMessageIds.add(sent.key.id);
              }
              console.log(
                `[WhatsApp Direto] Resposta enviada no WhatsApp para ${numeroLimpo} (${targetJid})`
              );
              return sent;
            },
          });
        } catch (err) {
          console.error('[WhatsApp Direto] Erro ao processar mensagem:', err);
        }
      }
    });
  } catch (error) {
    console.error('[WhatsApp Direto] Erro ao iniciar Baileys:', error);
  }
}

function getBaileysStatus() {
  return {
    status: connectionStatus,
    connectedNumber,
    qrCodeDataUrl,
  };
}

module.exports = {
  iniciarBaileys,
  getBaileysStatus,
  resolverTelefoneReal,
};
