import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const STATUS_PERMITIDOS = ['AGUARDANDO', 'EM_PROCESSO', 'ATENDIDO', 'CANCELADO'];

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: 'ID do atendimento é obrigatório.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { status } = body;

    if (!status || !STATUS_PERMITIDOS.includes(status)) {
      return NextResponse.json(
        {
          error: `Status inválido. Valores permitidos: ${STATUS_PERMITIDOS.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const atendimentoExistente = await prisma.atendimento.findUnique({
      where: { id },
    });

    if (!atendimentoExistente) {
      return NextResponse.json(
        { error: 'Atendimento não encontrado.' },
        { status: 404 }
      );
    }

    // Se a atendente marcar como CANCELADO no Dashboard, limpa o resumo e histórico
    // para que o cliente possa iniciar uma nova triagem limpa se mandar o gatilho novamente
    const dataUpdate =
      status === 'CANCELADO'
        ? {
            status,
            etapaBot: 'EM_TRIAGEM',
            resumoViagem: {},
            historico: [],
          }
        : { status };

    const atendimentoAtualizado = await prisma.atendimento.update({
      where: { id },
      data: dataUpdate,
    });

    return NextResponse.json(atendimentoAtualizado, { status: 200 });
  } catch (error) {
    console.error('[PATCH /api/atendimentos/[id]] Erro:', error);
    return NextResponse.json(
      { error: 'Erro interno ao atualizar status do atendimento.' },
      { status: 500 }
    );
  }
}
