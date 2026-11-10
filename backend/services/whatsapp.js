const axios = require('axios');

/**
 * Se o número brasileiro vier da Meta sem o 9º dígito (12 dígitos: 55 + DDD + 8 dígitos),
 * gera também a variação com o 9º dígito (13 dígitos: 55 + DDD + 9 + 8 dígitos),
 * pois a lista de números de teste da Meta no Brasil exige o formato cadastrado com 9.
 * @param {string} rawPhone
 * @returns {string}
 */
function normalizarTelefoneBrasilComNonoDigito(rawPhone) {
  const digits = String(rawPhone).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('55')) {
    return `${digits.slice(0, 4)}9${digits.slice(4)}`;
  }
  return digits;
}

/**
 * Envia mensagem de texto simples via WhatsApp Cloud API (Meta)
 * Com fallback automático para números brasileiros com/sem o 9º dígito
 * @param {string} to - Número de telefone do destinatário
 * @param {string} text - Conteúdo da mensagem
 */
async function sendWhatsAppMessage(to, text) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const apiVersion = process.env.WHATSAPP_API_VERSION || 'v20.0';

  if (!token || !phoneNumberId) {
    console.warn(
      '[WhatsApp Service] Credenciais WHATSAPP_TOKEN ou WHATSAPP_PHONE_NUMBER_ID ausentes. Simulando envio:',
      { to, text }
    );
    return { simulated: true };
  }

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
  const digitsOriginais = String(to).replace(/\D/g, '');
  const digitsComNove = normalizarTelefoneBrasilComNonoDigito(digitsOriginais);

  // Tenta enviar primeiro com o 9º dígito (padrão exigido na lista de teste da Meta) e depois com o original
  const candidatos =
    digitsComNove !== digitsOriginais
      ? [digitsComNove, digitsOriginais]
      : [digitsOriginais];

  let ultimoErro = null;

  for (const numeroDestino of candidatos) {
    try {
      const response = await axios.post(
        url,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: numeroDestino,
          type: 'text',
          text: {
            preview_url: false,
            body: text,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log(`[WhatsApp Service] Mensagem enviada com sucesso para ${numeroDestino}`);
      return response.data;
    } catch (error) {
      ultimoErro = error;
      const errCode = error.response?.data?.error?.code;
      // Se não for erro de número não permitido (#131030), não precisa tentar o próximo formato
      if (errCode !== 131030) {
        break;
      }
      console.warn(
        `[WhatsApp Service] Número ${numeroDestino} recusado (#131030), tentando formato alternativo...`
      );
    }
  }

  console.error(
    '[WhatsApp Service] Erro ao enviar mensagem:',
    ultimoErro?.response?.data || ultimoErro?.message
  );
  throw ultimoErro;
}

module.exports = {
  sendWhatsAppMessage,
  normalizarTelefoneBrasilComNonoDigito,
};
