import { NextRequest, NextResponse } from 'next/server';
import {
  processarMensagemRecebida,
  GATILHO_ESTRITO,
} from '../../../../backend/controllers/webhookController';

export const dynamic = 'force-dynamic';

/**
 * GET /api/webhook
 * Verificação oficial do Webhook da Meta Cloud API (Serverless na Vercel)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken =
    process.env.WHATSAPP_VERIFY_TOKEN || 'token_secreto_webhook_suica';

  if (mode && token) {
    if (mode === 'subscribe' && token === verifyToken) {
      return new NextResponse(challenge, { status: 200 });
    }
    return new NextResponse('Forbidden', { status: 403 });
  }

  return NextResponse.json({
    status: 'webhook_active',
    service: 'CD Consultoria de Viagem',
    trigger: GATILHO_ESTRITO,
  });
}

/**
 * POST /api/webhook
 * Recebimento de mensagens do WhatsApp Cloud API direto na Vercel
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body || body.object !== 'whatsapp_business_account') {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messageObj = value?.messages?.[0];

    if (!messageObj || messageObj.type !== 'text') {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const telefone = String(messageObj.from).replace(/\D/g, '');
    const textoRecebido = (messageObj.text?.body || '').trim();
    const nomePerfil = value?.contacts?.[0]?.profile?.name || null;

    if (!telefone || !textoRecebido) {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const resultado = await processarMensagemRecebida({
      telefone,
      textoRecebido,
      nomePerfil,
    });

    return NextResponse.json(resultado, { status: 200 });
  } catch (error) {
    console.error('[POST /api/webhook] Erro:', error);
    return NextResponse.json(
      { error: 'Internal processing error' },
      { status: 200 }
    );
  }
}
