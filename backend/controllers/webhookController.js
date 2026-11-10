const prisma = require('../services/prisma');
const { sendWhatsAppMessage } = require('../services/whatsapp');
const { processarTriagemIA } = require('../services/openai');

const GATILHO_ESTRITO =
  'Olá! Vim pelo site da CD Consultoria de Viagem e gostaria de fazer um orçamento.';

const MENSAGEM_TRAVA_HANDOFF =
  'Seu atendimento na CD Consultoria de Viagem já está registrado! Um de nossos consultores falará com você em breve.';

const MENSAGEM_FINALIZACAO_TRIAGEM =
  'Perfeito! Recebemos todas as informações da sua viagem. Sua ficha foi encaminhada para um consultor especialista da CD Consultoria de Viagem, que entrará em contato com você em breve com o seu orçamento!';

const STATUS_TRAVADOS = ['EM_PROCESSO', 'ATENDIDO', 'CANCELADO'];

// Memória de IDs de mensagens já processadas para evitar duplicidade
const mensagensProcessadas = new Set();

/**
 * Normaliza texto removendo acentos, pontuação e espaços extras
 */
function normalizarTexto(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Verifica se a mensagem enviada pelo cliente corresponde ao gatilho de entrada
 * da CD Consultoria de Viagem (aceitando variações naturais de "vim pelo site da CD Consultoria e gostaria de orçar...")
 */
function verificarFraseGatilho(texto) {
  const norm = normalizarTexto(texto);
  if (!norm) return false;

  if (norm === normalizarTexto(GATILHO_ESTRITO)) {
    return true;
  }

  // Aceita variações como "ola vim pelo site da cd consultoria e gostaria de orcar / fazer um orcamento"
  const mencionaCD =
    norm.includes('cd consultoria') || norm.includes('cd conaultoria');
  const mencionaSiteOuOrcamento =
    norm.includes('vim pelo site') ||
    norm.includes('orcamento') ||
    norm.includes('orcar') ||
    norm.includes('orca');

  if (mencionaCD && mencionaSiteOuOrcamento) {
    return true;
  }

  // Compatibilidade caso alguém ainda use o link antigo
  if (
    norm.includes('vim pelo site') &&
    norm.includes('iniciar minha inscricao')
  ) {
    return true;
  }

  return false;
}

/**
 * Processa a lógica de negócio do atendimento (usado tanto pelo Webhook da Meta quanto pela conexão direta QR Code/Baileys)
 */
async function processarMensagemRecebida({
  telefone,
  textoRecebido,
  nomePerfil,
  customSend,
}) {
  const enviar = customSend || sendWhatsAppMessage;

  console.log(
    `[Atendimento] Mensagem recebida de ${telefone} (${nomePerfil || 'Sem nome'}): "${textoRecebido}"`
  );

  let atendimento = await prisma.atendimento.findUnique({
    where: { telefone },
  });

  const ehFraseGatilho = verificarFraseGatilho(textoRecebido);

  // =========================================================================
  // REGRA 1: GATILHO DE ENTRADA (Números desconhecidos)
  // =========================================================================
  if (!atendimento) {
    if (!ehFraseGatilho) {
      console.log(
        `[Atendimento] Ignorado (gatilho não corresponde): "${textoRecebido}"`
      );
      return { ignored: true, reason: 'strict_trigger_mismatch' };
    }

    // Cria o registro inicial do cliente em triagem
    atendimento = await prisma.atendimento.create({
      data: {
        telefone,
        nome: nomePerfil,
        status: 'AGUARDANDO',
        etapaBot: 'EM_TRIAGEM',
        resumoViagem: {},
        historico: [],
      },
    });
  } else {
    // Se o atendimento foi marcado como CANCELADO no Dashboard,
    // permite que o cliente refaça o cadastro do zero quando mandar a frase de gatilho
    if (atendimento.status === 'CANCELADO') {
      if (!ehFraseGatilho) {
        console.log(
          `[Atendimento] Cliente ${telefone} está CANCELADO. Aguardando gatilho para novo cadastro.`
        );
        return { ignored: true, reason: 'cancelled_waiting_for_trigger' };
      }

      // Reinicia todo o cadastro do zero para permitir nova triagem completa
      atendimento = await prisma.atendimento.update({
        where: { id: atendimento.id },
        data: {
          status: 'AGUARDANDO',
          etapaBot: 'EM_TRIAGEM',
          resumoViagem: {},
          historico: [],
        },
      });
    } else if (ehFraseGatilho && atendimento.etapaBot === 'EM_TRIAGEM') {
      atendimento = await prisma.atendimento.update({
        where: { id: atendimento.id },
        data: {
          status: 'AGUARDANDO',
          resumoViagem: {},
          historico: [],
        },
      });
    }

    // =========================================================================
    // REGRA 2: REGRA DE HANDOFF / TRAVA (Silenciosa para conversa humana!)
    // =========================================================================
    if (
      STATUS_TRAVADOS.includes(atendimento.status) ||
      atendimento.etapaBot === 'FINALIZADO_BOT'
    ) {
      if (ehFraseGatilho) {
        await enviar(telefone, MENSAGEM_TRAVA_HANDOFF);
      } else {
        console.log(
          `[Atendimento] Handoff ativo (${atendimento.status}/${atendimento.etapaBot}) para ${telefone} — bot em silêncio para conversa humana.`
        );
      }
      return { handoff_locked: true };
    }
  }

  // =========================================================================
  // REGRA 3: EXTRAÇÃO COM IA (Janela Deslizante de 4 msgs + Memória dos 5 Campos)
  // =========================================================================
  const historicoAtual = Array.isArray(atendimento.historico)
    ? atendimento.historico
    : [];

  const resumoParcialAtual =
    atendimento.resumoViagem && typeof atendimento.resumoViagem === 'object'
      ? atendimento.resumoViagem
      : {};

  const resultadoIA = await processarTriagemIA(
    historicoAtual,
    textoRecebido,
    resumoParcialAtual
  );

  // =========================================================================
  // REGRA 4: FINALIZAÇÃO DA TRIAGEM (Function Calling: salvar_resumo_viagem)
  // =========================================================================
  if (resultadoIA.finalizado && resultadoIA.resumoViagem) {
    const resumo = resultadoIA.resumoViagem;

    await prisma.atendimento.update({
      where: { id: atendimento.id },
      data: {
        nome: resumo.nome || atendimento.nome,
        resumoViagem: resumo,
        status: 'AGUARDANDO',
        etapaBot: 'FINALIZADO_BOT',
        historico: [],
      },
    });

    await enviar(telefone, MENSAGEM_FINALIZACAO_TRIAGEM);

    return {
      status: 'triagem_finalizada',
      atendimentoId: atendimento.id,
    };
  }

  // Caso ainda esteja em triagem, salva os dados parciais já coletados + janela deslizante (máx 4 msgs)
  await prisma.atendimento.update({
    where: { id: atendimento.id },
    data: {
      nome: resultadoIA.dadosParciais?.nome || atendimento.nome,
      resumoViagem: resultadoIA.dadosParciais || resumoParcialAtual,
      historico: resultadoIA.novoHistorico,
    },
  });

  await enviar(telefone, resultadoIA.respostaTexto);

  return {
    status: 'em_triagem',
    atendimentoId: atendimento.id,
  };
}

/**
 * GET /webhook
 * Verificação oficial do Webhook da Meta Cloud API
 */
function verifyWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode && token) {
    if (mode === 'subscribe' && token === verifyToken) {
      console.log('[Webhook] Verificado com sucesso pela Meta.');
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  }

  return res.sendStatus(400);
}

/**
 * POST /webhook
 * Recebimento e processamento de mensagens do WhatsApp Cloud API
 */
async function handleWebhook(req, res) {
  try {
    const body = req.body;

    if (!body || body.object !== 'whatsapp_business_account') {
      return res.sendStatus(200);
    }

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messageObj = value?.messages?.[0];

    if (!messageObj || messageObj.type !== 'text') {
      return res.sendStatus(200);
    }

    if (messageObj.id && mensagensProcessadas.has(messageObj.id)) {
      return res.status(200).json({ deduplicated: true });
    }
    if (messageObj.id) {
      mensagensProcessadas.add(messageObj.id);
    }

    const telefone = String(messageObj.from).replace(/\D/g, '');
    const textoRecebido = (messageObj.text?.body || '').trim();
    const nomePerfil = value?.contacts?.[0]?.profile?.name || null;

    if (!telefone || !textoRecebido) {
      return res.sendStatus(200);
    }

    const resultado = await processarMensagemRecebida({
      telefone,
      textoRecebido,
      nomePerfil,
    });

    return res.status(200).json(resultado);
  } catch (error) {
    console.error('[Webhook Controller] Erro ao processar mensagem:', error);
    return res.status(200).json({ error: 'Internal processing error' });
  }
}

module.exports = {
  verifyWebhook,
  handleWebhook,
  processarMensagemRecebida,
  verificarFraseGatilho,
  GATILHO_ESTRITO,
  MENSAGEM_TRAVA_HANDOFF,
  MENSAGEM_FINALIZACAO_TRIAGEM,
};
