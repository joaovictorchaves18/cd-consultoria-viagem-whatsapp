const OpenAI = require('openai');

const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
const isGeminiKey =
  Boolean(process.env.GEMINI_API_KEY) ||
  (apiKey && (apiKey.startsWith('AQ.') || apiKey.startsWith('AIza')));

const openai = new OpenAI({
  apiKey,
  ...(isGeminiKey
    ? { baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/' }
    : {}),
});

const AI_MODEL =
  process.env.AI_MODEL || (isGeminiKey ? 'gemini-3.5-flash' : 'gpt-4o-mini');

// Os 5 campos objetivos solicitados pela CD Consultoria de Viagem
const CAMPOS_ORDEM = [
  'nome',
  'periodo',
  'formaViagem',
  'aeroportoChegada',
  'quantidadePessoas',
];

const DESCRICAO_CAMPOS = {
  nome: '1. Nome completo ou como o cliente prefere ser chamado(a)',
  periodo: '2. Período da viagem (mês, datas previstas ou quantidade de dias)',
  formaViagem: '3. Forma de viagem desejada (ex: pacote completo, excursão/grupo, roteiro personalizado individual, aéreo + hotel, trem/carro)',
  aeroportoChegada: '4. Aeroporto de chegada (ou cidade/destino de desembarque pretendido)',
  quantidadePessoas: '5. Quantidade de pessoas que vão viajar (ex: 2 adultos, casal, família com crianças)',
};

function construirSystemPrompt(dadosParciais = {}) {
  const preenchidos = CAMPOS_ORDEM.filter(
    (c) => dadosParciais[c] && String(dadosParciais[c]).trim() !== ''
  );
  const faltantes = CAMPOS_ORDEM.filter(
    (c) => !dadosParciais[c] || String(dadosParciais[c]).trim() === ''
  );

  const resumoJaColetado =
    preenchidos.length > 0
      ? preenchidos.map((c) => `- ${c}: "${dadosParciais[c]}"`).join('\n')
      : 'Nenhum dado coletado ainda.';

  const listaFaltantes =
    faltantes.length > 0
      ? faltantes.map((c) => `- ${DESCRICAO_CAMPOS[c]}`).join('\n')
      : 'TODOS OS 5 CAMPOS JÁ FORAM COLETADOS!';

  return `Você é a assistente virtual de triagem da *CD Consultoria de Viagem*.
Seu único objetivo é coletar, de forma cordial, simpática e rápida, apenas 5 informações essenciais antes de passar o atendimento para um consultor especialista montar o orçamento personalizado.

DADOS JÁ COLETADOS DO CLIENTE ATÉ AGORA (NÃO PERGUNTE NOVAMENTE ESTES ITENS!):
${resumoJaColetado}

ITENS QUE AINDA FALTAM PERGUNTAR (em ordem):
${listaFaltantes}

REGRAS ESTRITAS DE CONDUTA:
1. Primeiro, analise a última resposta do cliente e extraia qualquer informação nova dentre os 5 campos (nome, periodo, formaViagem, aeroportoChegada, quantidadePessoas).
2. NUNCA repita perguntas sobre dados que já estão na lista "DADOS JÁ COLETADOS DO CLIENTE ATÉ AGORA" ou que o cliente acabou de responder!
3. Faça APENAS UMA pergunta por vez (pergunte sobre o PRÓXIMO item da lista de "ITENS QUE AINDA FALTAM PERGUNTAR").
4. NUNCA invente, estime ou informe preços. Explique que o consultor da CD Consultoria de Viagem enviará o orçamento detalhado logo após essas 5 perguntas rápidas.
5. Se com a resposta atual do cliente TODOS os 5 itens estiverem preenchidos (não faltar mais nenhum item), acione IMEDIATAMENTE a função "salvar_resumo_viagem".
6. Enquanto ainda faltar algum dos 5 itens, acione a função "atualizar_progresso_triagem" passando os campos que você já descobriu e a próxima pergunta para o cliente.`;
}

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'atualizar_progresso_triagem',
      description:
        'Salva os dados parciais já informados pelo cliente até o momento e envia a próxima pergunta da triagem (usado enquanto ainda faltam campos para completar os 5 itens da CD Consultoria de Viagem).',
      parameters: {
        type: 'object',
        properties: {
          dadosColetados: {
            type: 'object',
            description:
              'Campos já identificados até agora (mantenha os anteriores e adicione o novo)',
            properties: {
              nome: { type: 'string' },
              periodo: { type: 'string' },
              formaViagem: { type: 'string' },
              aeroportoChegada: { type: 'string' },
              quantidadePessoas: { type: 'string' },
            },
          },
          proximaPergunta: {
            type: 'string',
            description:
              'Mensagem cordial com APENAS UMA pergunta referente ao próximo campo que ainda falta coletar.',
          },
        },
        required: ['dadosColetados', 'proximaPergunta'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'salvar_resumo_viagem',
      description:
        'Finaliza a triagem da CD Consultoria de Viagem quando TODOS os 5 campos obrigatórios tiverem sido coletados.',
      parameters: {
        type: 'object',
        properties: {
          nome: {
            type: 'string',
            description: 'Nome do cliente',
          },
          periodo: {
            type: 'string',
            description: 'Período ou datas previstas da viagem',
          },
          formaViagem: {
            type: 'string',
            description: 'Forma de viagem escolhida pelo cliente',
          },
          aeroportoChegada: {
            type: 'string',
            description: 'Aeroporto de chegada ou cidade de desembarque',
          },
          quantidadePessoas: {
            type: 'string',
            description: 'Quantidade de pessoas que irão viajar',
          },
        },
        required: CAMPOS_ORDEM,
      },
    },
  },
];

/**
 * Aplica janela deslizante mantendo apenas as últimas 4 mensagens
 * @param {Array<{role: string, content: string}>} historico
 * @returns {Array<{role: string, content: string}>}
 */
function aplicarJanelaDeslizante(historico) {
  if (!Array.isArray(historico)) return [];
  return historico.slice(-4);
}

/**
 * Processa a interação do cliente usando janela deslizante de 4 mensagens + memória dos 5 campos
 */
async function processarTriagemIA(
  historicoAtual,
  novaMensagemUsuario,
  resumoParcialAtual = {}
) {
  const dadosAtuais =
    resumoParcialAtual && typeof resumoParcialAtual === 'object'
      ? { ...resumoParcialAtual }
      : {};

  const historicoComNovaMsg = aplicarJanelaDeslizante([
    ...(Array.isArray(historicoAtual) ? historicoAtual : []),
    { role: 'user', content: novaMensagemUsuario },
  ]);

  const messages = [
    { role: 'system', content: construirSystemPrompt(dadosAtuais) },
    ...historicoComNovaMsg,
  ];

  const response = await openai.chat.completions.create({
    model: AI_MODEL,
    messages,
    tools: TOOLS,
    tool_choice: 'auto',
    temperature: 0.2,
  });

  const choice = response.choices[0]?.message;

  if (!choice) {
    throw new Error('Resposta vazia da IA.');
  }

  if (choice.tool_calls && choice.tool_calls.length > 0) {
    const finalCall = choice.tool_calls.find(
      (tc) => tc.function?.name === 'salvar_resumo_viagem'
    );

    if (finalCall) {
      const args =
        typeof finalCall.function.arguments === 'string'
          ? JSON.parse(finalCall.function.arguments)
          : finalCall.function.arguments;

      const resumoCompleto = { ...dadosAtuais, ...args };

      return {
        finalizado: true,
        resumoViagem: resumoCompleto,
        dadosParciais: resumoCompleto,
        respostaTexto: null,
        novoHistorico: [],
      };
    }

    const partialCall = choice.tool_calls.find(
      (tc) => tc.function?.name === 'atualizar_progresso_triagem'
    );

    if (partialCall) {
      const args =
        typeof partialCall.function.arguments === 'string'
          ? JSON.parse(partialCall.function.arguments)
          : partialCall.function.arguments;

      const novosDados = {
        ...dadosAtuais,
        ...(args.dadosColetados || {}),
      };

      const todosPreenchidos = CAMPOS_ORDEM.every(
        (campo) =>
          novosDados[campo] && String(novosDados[campo]).trim().length > 0
      );

      if (todosPreenchidos) {
        return {
          finalizado: true,
          resumoViagem: novosDados,
          dadosParciais: novosDados,
          respostaTexto: null,
          novoHistorico: [],
        };
      }

      const pergunta =
        args.proximaPergunta ||
        choice.content?.trim() ||
        'Perfeito! Poderia me informar o próximo detalhe para o seu orçamento na CD Consultoria de Viagem?';

      const novoHistorico = aplicarJanelaDeslizante([
        ...historicoComNovaMsg,
        { role: 'assistant', content: pergunta },
      ]);

      return {
        finalizado: false,
        resumoViagem: null,
        dadosParciais: novosDados,
        respostaTexto: pergunta,
        novoHistorico,
      };
    }
  }

  const respostaAssistente =
    choice.content?.trim() ||
    'Poderia me informar mais detalhes para continuarmos seu atendimento na CD Consultoria de Viagem?';

  const novoHistorico = aplicarJanelaDeslizante([
    ...historicoComNovaMsg,
    { role: 'assistant', content: respostaAssistente },
  ]);

  return {
    finalizado: false,
    resumoViagem: null,
    dadosParciais: dadosAtuais,
    respostaTexto: respostaAssistente,
    novoHistorico,
  };
}

module.exports = {
  processarTriagemIA,
  aplicarJanelaDeslizante,
  CAMPOS_ORDEM,
};
